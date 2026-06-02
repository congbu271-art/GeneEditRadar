import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "../components/ui/button";

test("renders a primary UI action", () => {
  const html = renderToStaticMarkup(<Button>查看文献</Button>);

  assert.match(html, /查看文献/);
  assert.match(html, /bg-primary/);
  assert.match(html, /rounded-full/);
});
