"use client";

import { useState } from "react";
import { Search, Sparkles, Loader2, BookOpen, ExternalLink, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SemanticResult {
  papers: any[];
  answer: string | null;
}

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SemanticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "检索失败，请稍后重试。");
        setResults(null);
      } else {
        setResults(data);
      }
    } catch {
      setError("网络错误，请检查连接后重试。");
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="glass-panel border-none shadow-soft overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-70" />
        <CardHeader className="pb-6">
          <div className="flex items-center gap-2 text-cyan-600 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">智能语义检索</span>
          </div>
          <CardTitle className="text-3xl font-display font-bold tracking-tight text-slate-900">
            文献大脑 <span className="text-gradient">GeneRadar AI</span>
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            基于 RAG 技术深度解析最新基因编辑研究。输入自然语言，获取带有引用的专业解答与选题灵感。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600/20" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例如：'大豆中 GmMLH1dn 是如何提升 PE 效率的？'"
                className="pl-11 h-12 bg-white/40 border-slate-100 rounded-2xl focus:border-cyan-200 focus:ring-4 focus:ring-cyan-500/5 transition-all text-sm"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !query.trim()}
              className="h-12 px-8 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white shadow-lg shadow-cyan-600/20 transition-all font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  解析中
                </>
              ) : (
                "开始检索"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>检索失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results?.answer && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="relative p-8 rounded-[2.5rem] bg-white shadow-soft border border-slate-100/80 overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
              <Sparkles className="h-24 w-24 text-cyan-600" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-xl bg-cyan-600 flex items-center justify-center shadow-glow">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900 tracking-tight">AI 深度洞察</h3>
            </div>
            <div className="text-slate-700 leading-8 text-[15px] prose prose-slate max-w-none">
              {results.answer.split("\n").map((line, i) => (
                <p key={i} className="mb-4">{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {results?.papers && results.papers.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              引用文献 ({results.papers.length})
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.papers.map((paper, index) => (
              <Card key={paper.id} className="relative glass-panel glass-panel-hover border-none shadow-soft group">
                <div className="absolute top-4 right-4 bg-cyan-600/10 text-cyan-700 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border border-cyan-200/20">
                  {paper.relevanceScore}% 匹配
                </div>
                <CardHeader className="pb-3 pt-6">
                  <span className="text-[10px] font-bold text-slate-400 mb-1">#0{index + 1}</span>
                  <CardTitle className="text-sm font-bold leading-relaxed group-hover:text-cyan-700 transition-colors line-clamp-2">
                    {paper.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-[10px] flex items-center gap-2 text-slate-400 font-medium" suppressHydrationWarning>
                    <span className="text-slate-600">{paper.journal}</span>
                    <span>•</span>
                    <span>{paper.publishedAt?.slice(0, 4)}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                    {paper.abstract}
                  </p>
                  <div className="pt-2 flex justify-end">
                    {paper.sourceUrl && (
                      <a 
                        href={paper.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-slate-50 hover:bg-cyan-50 text-slate-400 hover:text-cyan-700 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {results?.papers && results.papers.length === 0 && !isLoading && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
          <p className="text-slate-500">未找到相关文献，尝试换一个更宽泛的关键词？</p>
        </div>
      )}
    </div>
  );
}
