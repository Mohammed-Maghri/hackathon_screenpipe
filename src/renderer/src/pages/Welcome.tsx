import '../styles/welcome.css';
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowDown, ArrowRight, CircleHelp } from "lucide-react";
import { AppMark } from "../components/AppMark";
import { AppearanceSelector } from "../components/AppearanceSelector";
import { TitleBar } from "../components/TitleBar";
import { GhostLogo } from "../components/GhostLogo";
import { WelcomeDialog, type DialogKind } from "../components/WelcomeDialog";

const introduction = [
  {
    title: "Describe your routine",
    description: "Tell Ghost about the work you repeat.",
  },
  {
    title: "Review and teach the steps",
    description: "Shape the workflow and record any browser actions.",
  },
  {
    title: "Test it, then run it",
    description: "Check the result before running or scheduling.",
  },
];

const exampleSteps = [
  { app: "Google Chrome", title: "Collect the numbers", detail: "Open the report in your browser" },
  { app: "Excel", title: "Prepare the summary", detail: "Turn the data into a clear report" },
  { app: "Slack", title: "Share with your team", detail: "Post the summary in Slack" },
];

/** An instructional example, kept separate from saved workflows and execution state. */
function ExampleWorkflow() {
  return (
    <figure className="welcome-example w-full max-w-[360px]">
      <figcaption className="mb-8 [@media(max-height:740px)]:mb-6">
        <p className="mb-3 text-xs font-medium text-muted">Example workflow</p>
        <h2 className="text-2xl font-medium tracking-tight">The weekly team report.</h2>
        <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-muted">
          A familiar routine, broken into steps you can see and shape.
        </p>
      </figcaption>
      <ol className="m-0 list-none p-0" aria-label="Weekly team report example">
        {exampleSteps.map((step, index) => (
          <li key={step.app}>
            {index > 0 && (
              <div aria-hidden="true" className="flex h-10 items-center pl-8 text-action [@media(max-height:740px)]:h-7 [@media(max-height:740px)]:pl-7">
                <ArrowDown size={18} strokeWidth={1.5} />
              </div>
            )}
            <div className="welcome-example-node flex items-center gap-4 rounded-card border border-line bg-panel p-5 shadow-soft [@media(max-height:740px)]:p-4 [&_.app-mark]:size-10 [&_.app-mark]:rounded-control [&_.app-mark]:border-0 [&_.app-mark]:bg-sidebar [&_.app-mark]:p-2">
              <AppMark app={step.app} />
              <div className="min-w-0">
                <h3 className="text-sm font-medium tracking-normal">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function Welcome() {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  return (
    <div className="welcome-screen window-shell relative flex h-full min-h-0 flex-col overflow-hidden bg-canvas text-ink">
      <div className="welcome-titlebar relative h-14 shrink-0 border-b border-line bg-canvas [&>.titlebar]:h-full">
        <TitleBar onSkip={() => navigate("/dashboard")} />
      </div>
      <main className="welcome-main grid min-h-0 flex-1 grid-cols-[1.1fr_1fr] overflow-y-auto overscroll-contain max-[1099px]:grid-cols-1">
        <section aria-labelledby="welcome-heading" className="flex items-center justify-center px-12 py-12 max-[1250px]:px-8 [@media(max-height:740px)]:py-6">
          <div className="welcome-content w-full max-w-[440px]">
            <div className="welcome-brand mb-8 [@media(max-height:740px)]:mb-6">
              <GhostLogo />
            </div>
            <h1 id="welcome-heading" className="text-[52px] font-medium leading-[1.08] tracking-[-.045em] max-[1250px]:text-5xl [@media(max-height:740px)]:text-[40px]">
              Give your routine
              <span className="block text-action">a better flow.</span>
            </h1>
            <p className="mt-5 max-w-[39ch] text-base leading-relaxed text-muted [@media(max-height:740px)]:mt-4 [@media(max-height:740px)]:text-sm">
              Build a routine you can understand, teach, and run. One step at a time.
            </p>
            <ol className="welcome-guide-steps my-8 grid list-none gap-5 p-0 [@media(max-height:740px)]:my-6 [@media(max-height:740px)]:gap-4" aria-label="How Ghost works">
              {introduction.map((step, index) => (
                <li className="flex items-start gap-3.5 [@media(max-height:740px)]:items-center" key={step.title}>
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-xs tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="text-sm font-medium leading-5 tracking-normal">{step.title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted [@media(max-height:740px)]:hidden">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button className="dash-button dash-button--primary group min-h-11 gap-5" onClick={() => navigate("/dashboard")}>
              Open workspace
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </div>
        </section>
        <aside className="flex items-center justify-center border-l border-line bg-sidebar px-12 py-12 max-[1250px]:px-8 max-[1099px]:hidden [@media(max-height:740px)]:py-6" aria-label="A workflow example">
          <ExampleWorkflow />
        </aside>
      </main>
      <footer className="welcome-footer flex min-h-20 shrink-0 items-center justify-between gap-6 border-t border-line bg-canvas px-8 py-4 max-[850px]:px-6">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted">Appearance</span>
          <AppearanceSelector compact />
        </div>
        <button className="text-button min-h-10 gap-2" onClick={() => setDialog("explain")}>
          <CircleHelp size={16} aria-hidden="true" />
          How Ghost works
        </button>
      </footer>
      <WelcomeDialog kind={dialog} onClose={() => setDialog(null)} onStart={() => { setDialog(null); navigate("/dashboard"); }} />
    </div>
  );
}
