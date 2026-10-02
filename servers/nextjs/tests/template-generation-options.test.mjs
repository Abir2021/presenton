import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transform } from "esbuild";

const require = createRequire(import.meta.url);
const source = await readFile(
  new URL("../app/(presentation-generator)/custom-template/CustomTemplatePage.tsx", import.meta.url),
  "utf8",
);
// Isolate the real modal from browser-only slide editor dependencies.
const modalSource = source.slice(
  source.indexOf("function SaveTemplateModal("),
  source.indexOf("const CustomTemplatePage ="),
);
const compiled = await transform(`
  import React, { useState, useEffect } from "react";
  const X = () => null;
  const Loader2 = () => null;
  const pillGradient = "none";
  ${modalSource}
  export default SaveTemplateModal;
`, { loader: "tsx", format: "cjs", jsx: "transform" });
const module = { exports: {} };
new Function("require", "module", "exports", compiled.code)(require, module, module.exports);
const SaveTemplateModal = module.exports.default;
const baseProps = {
  isOpen: true,
  defaultName: "Custom",
  isSaving: false,
  onClose() {},
  async onSave() {},
};

test("creation modal exposes all three generation controls and preserves false", () => {
  const html = renderToStaticMarkup(React.createElement(SaveTemplateModal, {
    ...baseProps,
    generationOptions: { text_growth: false, visual_replacement: true, flexible_grouping: false },
    onGenerationOptionsChange() {},
  }));
  assert.match(html, /Text growth/);
  assert.match(html, /Visual replacement/);
  assert.match(html, /Flexible grouping/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
});

test("saving an existing template does not expose generation controls", () => {
  const html = renderToStaticMarkup(React.createElement(SaveTemplateModal, baseProps));
  assert.doesNotMatch(html, /type="checkbox"/);
});

test("generation controls are disabled during submission", () => {
  const html = renderToStaticMarkup(React.createElement(SaveTemplateModal, {
    ...baseProps,
    isSaving: true,
    generationOptions: { text_growth: true, visual_replacement: true, flexible_grouping: true },
    onGenerationOptionsChange() {},
  }));
  assert.match(html, /<fieldset[^>]*disabled=""/);
  assert.equal((html.match(/checked=""/g) ?? []).length, 3);
});
