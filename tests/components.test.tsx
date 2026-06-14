import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("Card component renders correctly", () => {
  const html = renderToStaticMarkup(
    <Card>
      <CardHeader>
        <CardTitle>测试标题</CardTitle>
      </CardHeader>
      <CardContent>
        <p>测试内容</p>
      </CardContent>
    </Card>
  );
  
  assert.ok(html.includes("测试标题"), "Should contain title");
  assert.ok(html.includes("测试内容"), "Should contain content");
  assert.ok(html.includes("card"), "Should have card class");
});

test("Badge component renders variants correctly", () => {
  const defaultBadge = renderToStaticMarkup(<Badge>默认</Badge>);
  const successBadge = renderToStaticMarkup(<Badge variant="success">成功</Badge>);
  const warningBadge = renderToStaticMarkup(<Badge variant="warning">警告</Badge>);
  
  assert.ok(defaultBadge.includes("默认"), "Default badge should contain text");
  assert.ok(successBadge.includes("成功"), "Success badge should contain text");
  assert.ok(warningBadge.includes("警告"), "Warning badge should contain text");
});

test("Button component renders correctly", () => {
  const html = renderToStaticMarkup(
    <Button>点击我</Button>
  );
  
  assert.ok(html.includes("点击我"), "Should contain button text");
  assert.ok(html.includes("button"), "Should have button element");
});

test("Button component renders with variant props", () => {
  const outlineButton = renderToStaticMarkup(
    <Button variant="outline">轮廓按钮</Button>
  );
  
  assert.ok(outlineButton.includes("轮廓按钮"), "Outline button should contain text");
});

test("Card with nested components", () => {
  const html = renderToStaticMarkup(
    <Card>
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant="success">在线</Badge>
          <Button variant="outline">操作</Button>
        </div>
      </CardContent>
    </Card>
  );
  
  assert.ok(html.includes("在线"), "Should contain badge text");
  assert.ok(html.includes("操作"), "Should contain button text");
});
