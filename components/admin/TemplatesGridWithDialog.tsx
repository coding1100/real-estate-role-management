"use client";

import { Eye } from "lucide-react";
import { AddPageDialog } from "@/components/admin/AddPageDialog";

interface DomainOption {
  id: string;
  hostname: string;
}

interface TemplateOption {
  id: string;
  type: string;
  name: string;
}

interface TemplatesGridWithDialogProps {
  domains: DomainOption[];
  templates: TemplateOption[];
}

export function TemplatesGridWithDialog({
  domains,
  templates,
}: TemplatesGridWithDialogProps) {
  return (
    <AddPageDialog
      domains={domains}
      templates={templates}
      defaultTemplate="buyer"
      trigger={(open) => (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-sm bg-white p-4 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex justify-center max-[768px]:w-full">
                  <a
                    href={`/templates/master/${tpl.type}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block h-[290px] w-[500px] max-[768px]:w-full max-[768px]:max-w-full max-[768px]:h-48 overflow-hidden !rounded-md border border-zinc-200 bg-zinc-50"
                  >
                    <iframe
                      title={`${tpl.name} preview`}
                      src={`/templates/master/${tpl.type}`}
                      style={{
                        width: "1280px",
                        height: "720px",
                        transform: "scale(0.4)",
                        transformOrigin: "top left",
                      }}
                      className="border-0 pointer-events-none template-preview-iframe"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow">
                        <Eye className="h-5 w-5" />
                      </div>
                    </div>
                  </a>
                </div>

                <div className="space-y-1 text-center">
                  <p className="text-[14px] uppercase tracking-[0.2em] text-zinc-400">
                    {tpl.type}
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {tpl.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => open(tpl.type)}
                    className="mt-2 inline-flex items-center !rounded-md bg-zinc-900 px-3 py-1.5 text-md font-medium text-white hover:bg-zinc-800"
                  >
                    Create page from template
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    />
  );
}
