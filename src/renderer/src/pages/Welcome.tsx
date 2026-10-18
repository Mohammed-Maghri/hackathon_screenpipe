import '../styles/welcome.css';
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CircleHelp } from "lucide-react";
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
  { title: "Collect", apps: ["Chrome", "Screenpipe", "Drive"], detail: "Pages, activity & files" },
  { title: "Prepare", apps: ["Excel", "Notion"], detail: "Tables & summaries" },
  { title: "Share", apps: ["Slack", "Gmail", "Outlook"], detail: "Channels & email" },
];

/** An instructional example, kept separate from saved workflows and execution state. */
function ExampleWorkflow() {
  return (
    <figure className="welcome-flow-preview">
      <figcaption className="welcome-orbit-heading">
        <div className="welcome-orbit" aria-hidden="true"><div className="welcome-orbit-ghost"><GhostLogo compact/></div></div>
        <span className="welcome-preview-label">FROM ROUTINE TO WORKFLOW</span>
        <h2>A report, without the repetition.</h2>
        <p>Collect the data. Prepare the report. Keep your team informed.</p>
      </figcaption>
      <div className="welcome-preview-board">
        <div className="welcome-preview-top"><span>Weekly team report</span><small>Illustrative workflow</small></div>
        <ol aria-label="Weekly team report example" className="welcome-preview-chain">
          {exampleSteps.map((step,index)=><li key={step.title}>
            <span className="welcome-preview-number">0{index+1}</span>
            <div className="welcome-preview-apps" aria-label={step.title+': '+step.apps.join(', ')}>{step.apps.map(app=><div className="welcome-preview-app" key={app}><AppMark app={app}/></div>)}</div>
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
            {index<exampleSteps.length-1&&<span className="welcome-preview-connector" aria-hidden="true"><ArrowRight size={13}/></span>}
          </li>)}
        </ol>
        <div className="welcome-preview-outcome"><span>One routine. Multiple tasks.</span><strong>You review the result.</strong></div>
      </div>
      <p className="welcome-preview-caption">Example app combinations · Availability depends on connected integrations.</p>
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
        <aside className="welcome-visual-section flex items-center justify-center px-12 py-12 max-[1250px]:px-8 max-[1099px]:hidden [@media(max-height:740px)]:py-6" aria-label="A workflow example">
          <ExampleWorkflow />
        </aside>
      </main>
      <footer className="welcome-footer flex min-h-20 shrink-0 items-center justify-between gap-6 px-8 py-4 max-[850px]:px-6">
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
