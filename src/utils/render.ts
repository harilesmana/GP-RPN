import ejs from "ejs";
import { readFileSync } from "fs";
import { join } from "path";

export function render(view: string, data: any = {}) {
  const filePath = join(import.meta.dir, "../views", `${view}.ejs`);
  const layoutPath = join(import.meta.dir, "../views", "layout.ejs");

  const body = ejs.render(readFileSync(filePath, "utf-8"), data, {
    filename: filePath,
  });

  return ejs.render(readFileSync(layoutPath, "utf-8"), {
    ...data,
    body,
  });
}
