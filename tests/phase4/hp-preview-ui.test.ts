import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { addStudent, initialCombatState, scaleEncounter, startQuestion } from "../../worker/combat/engine.ts";
import { publicSnapshot } from "../../worker/combat/session-object.ts";
import { fight, student } from "./fixtures.ts";
import { hpLabel } from "../../shared/combat/encounters.ts";

test("battlefield uses waiting/estimated/actual HP in visible text, tooltips and accessible labels", async () => {
  const dir = await mkdtemp(join(process.cwd(), ".hp-preview-ui-"));
  try {
    const outfile = join(dir, "CombatBoard.mjs");
    await build({ entryPoints: ["client/src/components/CombatBoard.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", loader: { ".css": "empty", ".png": "empty", ".webp": "empty" } });
    const { CombatBoard } = await import(pathToFileURL(outfile).href);
    const render = (state: ReturnType<typeof initialCombatState>) => JSDOM.fragment(renderToStaticMarkup(createElement(CombatBoard, { state })));
    const empty = initialCombatState("ABC234", fight);
    const emptyBoard = render(publicSnapshot(empty, fight));
    const emptyEnemy = emptyBoard.querySelector(".battle-enemy")!;
    assert.match(emptyBoard.querySelector(".battle-enemy-list")!.textContent!, /Waiting for players/);
    assert.equal(emptyEnemy.textContent, "");
    assert.match(emptyEnemy.getAttribute("title")!, /Waiting for players/);
    assert.match(emptyEnemy.getAttribute("aria-label")!, /Waiting for players/);
    assert.equal(emptyEnemy.querySelector('[role="meter"]'), null, "empty rooms must not expose placeholder HP in a meter");

    const waiting = addStudent(empty, student());
    const preview = publicSnapshot(waiting, fight);
    const previewBoard = render(preview);
    const previewEnemy = previewBoard.querySelector(".battle-enemy")!;
    assert.equal(previewBoard.querySelector(".battle-enemy-list .battle-enemy-hp")!.textContent, `Estimated HP ${hpLabel(preview.enemies[0].maxHealth)}`);
    for (const attribute of ["title", "aria-label"]) assert.match(previewEnemy.getAttribute(attribute)!, /Estimated HP/);
    assert.match(previewEnemy.querySelector('[role="meter"]')!.getAttribute("aria-label")!, /Estimated HP/);

    const active = startQuestion(scaleEncounter(waiting, fight));
    active.enemies[0].health /= 2;
    const activeBoard = render(publicSnapshot(active, fight));
    const activeEnemy = activeBoard.querySelector(".battle-enemy")!;
    assert.equal(activeBoard.querySelector(".battle-enemy-list .battle-enemy-hp")!.textContent, `${hpLabel(active.enemies[0].health)}/${hpLabel(active.enemies[0].maxHealth)} HP`);
    assert.doesNotMatch(activeEnemy.outerHTML, /Estimated HP|Waiting for players/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
