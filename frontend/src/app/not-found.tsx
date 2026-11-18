import Link from "next/link";
import NotFoundPanel from "@/components/NotFoundPanel";
import { PRODUCT_NAME } from "@/lib/product";

export const metadata = { title: `Page not found | ${PRODUCT_NAME}` };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-md bg-ink font-serif text-lg leading-none text-white"
            >
              &sect;
            </span>
            <span className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center px-6">
        <NotFoundPanel
          title="This page isn't in the file"
          body={
            <p>
              The address may be mistyped, or the page may have moved. Your cases are where you left them.{" "}
              <Link href="/" className="text-brand underline underline-offset-2">
                Back to the home page
              </Link>
            </p>
          }
        />
      </main>
    </div>
  );
}
