import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Clock3, Play, ScanLine, Zap } from '../components/ImageIcon'
import { TitleBar } from '../components/TitleBar'
import { GhostLogo } from '../components/GhostLogo'
import { FeatureRow } from '../components/FeatureRow'
import { Button } from '../components/Button'
import { WelcomeDialog, type DialogKind } from '../components/WelcomeDialog'
import landscape from '../assets/landscape.png'

export function Welcome() {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  return <div className="window-shell">
    <div className="artwork" aria-hidden="true"><img src={landscape} alt="" /><div className="artwork-shade" /></div>
    <TitleBar onSkip={() => navigate('/dashboard')} />
    <main className="welcome-main">
      <motion.div className="welcome-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}>
        <GhostLogo />
        <section className="hero" aria-labelledby="welcome-title">
          <p className="eyebrow">Automate what you already do</p>
          <h1 id="welcome-title">Your work,<br /><span>understood.</span></h1>
          <p className="subtitle">Ghost learns from your activity and helps you<br className="wide-break" /> turn it into automations.</p>
          <ul className="features">
            <FeatureRow icon={ScanLine} title="Powered by Screenpipe">Use your real activity, not guesswork.</FeatureRow>
            <FeatureRow icon={Zap} title="Turn actions into workflows">From daily tasks to powerful automations.</FeatureRow>
            <FeatureRow icon={Clock3} title="Save time, focus on what matters">Let Ghost handle repetitive work.</FeatureRow>
          </ul>
          <div className="actions"><Button onClick={() => navigate('/dashboard')}>Get started <ArrowRight size={19} /></Button><Button variant="secondary" onClick={() => setDialog('explain')}>See how it works <Play size={16} /></Button></div>
        </section>
        <footer className="tagline">Less manual work.<br />A brighter tomorrow.</footer>
      </motion.div>
      <aside className="manifesto" aria-label="Observe, understand, automate, freedom"><span>Observe</span><span>Understand</span><span>Automate</span><span>Freedom</span><i /></aside>
    </main>
    <span className="version">v0.1.0</span>
    <WelcomeDialog kind={dialog} onClose={() => setDialog(null)} onStart={() => navigate('/dashboard')} />
  </div>
}
