type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type EmailProvider = "resend" | "sendgrid" | "console";

function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  return "console";
}

async function sendWithResend(options: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "GeneEditRadar <noreply@geneeditradar.demo>",
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function sendWithSendGrid(options: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: "SENDGRID_API_KEY not configured" };

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: options.to }],
        }],
        from: {
          email: process.env.EMAIL_FROM || "noreply@geneeditradar.demo",
          name: "GeneEditRadar",
        },
        subject: options.subject,
        content: [{
          type: "text/html",
          value: options.html,
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function sendWithConsole(options: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  console.log("=== Email Digest ===");
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Content: ${options.text || options.html.slice(0, 200)}...`);
  console.log("===================");
  return { ok: true };
}

export async function sendEmail(options: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  const provider = getEmailProvider();
  
  switch (provider) {
    case "resend":
      return sendWithResend(options);
    case "sendgrid":
      return sendWithSendGrid(options);
    case "console":
    default:
      return sendWithConsole(options);
  }
}

export function generateDigestHtml(papers: Array<{ title: string; journal: string; publishedAt?: string; url?: string }>): string {
  const paperList = papers
    .map((p) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${p.url || '#'}" style="color: #0891b2; text-decoration: none; font-weight: 500;">
            ${p.title}
          </a>
          <br/>
          <span style="color: #64748b; font-size: 12px;">
            ${p.journal} ${p.publishedAt ? `· ${p.publishedAt}` : ''}
          </span>
        </td>
      </tr>
    `)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #0891b2, #6366f1); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">GeneEditRadar 文献摘要</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">您订阅的基因编辑领域最新文献</p>
        </div>
        <div style="padding: 20px;">
          <p style="color: #64748b; margin: 0 0 16px 0;">
            以下是最近 ${papers.length} 篇与您订阅相关的文献：
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            ${paperList}
          </table>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              此邮件由 GeneEditRadar 自动发送 | <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://geneeditradar.demo'}" style="color: #0891b2;">查看完整报告</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateDigestText(papers: Array<{ title: string; journal: string; publishedAt?: string; url?: string }>): string {
  const paperList = papers
    .map((p, i) => `${i + 1}. ${p.title}\n   ${p.journal} ${p.publishedAt ? `· ${p.publishedAt}` : ''}\n   ${p.url || ''}`)
    .join("\n\n");

  return `GeneEditRadar 文献摘要\n\n以下是最近 ${papers.length} 篇与您订阅相关的文献：\n\n${paperList}\n\n---\n此邮件由 GeneEditRadar 自动发送`;
}
