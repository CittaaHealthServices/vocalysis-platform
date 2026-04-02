import { Card, CardTitle } from '../../components/ui'
import { BookOpen, Mic, ClipboardList, ShieldCheck, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

const Section = ({ icon: Icon, iconColor, title, children }) => (
  <Card className="p-6">
    <CardTitle className="flex items-center gap-2 mb-4">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      {title}
    </CardTitle>
    {children}
  </Card>
)

const CheckItem = ({ emoji, text }) => (
  <li className="flex items-start gap-2 text-gray-700">
    <span className="mt-0.5 text-base leading-none">{emoji}</span>
    <span>{text}</span>
  </li>
)

export const ProtocolGuide = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold text-app flex items-center gap-2">
        <BookOpen className="w-7 h-7 text-violet-600" /> Clinical Protocol Guide 📋
      </h1>
      <p className="text-gray-500 text-sm mt-1">Evidence-based standards for Vocalysis voice-biomarker sessions</p>
    </div>

    <motion.div className="grid grid-cols-1 gap-6" variants={container} initial="hidden" animate="show">

      <motion.div variants={item}>
        <Section icon={ShieldCheck} iconColor="text-violet-600" title="🏥 Assessment Standards">
          <p className="text-gray-700">
            Follow these protocols when conducting patient assessments through the Vocalysis Platform.
            All sessions must be conducted in a controlled environment to ensure acoustic integrity
            and valid VocoScale™ derivation.
          </p>
        </Section>
      </motion.div>

      <motion.div variants={item}>
        <Section icon={ClipboardList} iconColor="text-blue-600" title="✅ Pre-Assessment Checklist">
          <ul className="space-y-2">
            <CheckItem emoji="🔇" text="Ensure patient is in a quiet environment (background noise < 40 dB)" />
            <CheckItem emoji="🎙️" text="Verify audio equipment is functioning properly — test mic level before starting" />
            <CheckItem emoji="📝" text="Confirm informed consent obtained and documented" />
            <CheckItem emoji="📂" text="Review patient's prior assessment history and clinical notes" />
            <CheckItem emoji="💊" text="Note any medications that may affect vocal biomarkers (sedatives, stimulants)" />
            <CheckItem emoji="😴" text="Check patient's sleep status — flag if < 5 hrs last night" />
          </ul>
        </Section>
      </motion.div>

      <motion.div variants={item}>
        <Section icon={Mic} iconColor="text-emerald-600" title="🎙️ During Assessment">
          <p className="text-gray-700 mb-4">
            Maintain clinical professionalism and follow the prompts as specified. Do not deviate
            from the approved prompt sets — prompt consistency is essential for VocoCore™ ML accuracy.
          </p>
          <ul className="space-y-2">
            <CheckItem emoji="⏱️" text="Each vocal segment should be 30–90 seconds — prompt patient if too short" />
            <CheckItem emoji="🤫" text="Remain silent during recording to avoid background contamination" />
            <CheckItem emoji="👁️" text="Observe non-verbal cues — note distress signals in the session form" />
            <CheckItem emoji="🔄" text="Retry segment if technical failure detected (shown in recording UI)" />
            <CheckItem emoji="⚠️" text="Pause and invoke crisis protocol if patient expresses suicidal ideation" />
          </ul>
        </Section>
      </motion.div>

      <motion.div variants={item}>
        <Section icon={ClipboardList} iconColor="text-amber-600" title="📊 Post-Assessment">
          <ul className="space-y-2">
            <CheckItem emoji="🧠" text="Review VocoCore™ scores for clinical validity — flag anomalies" />
            <CheckItem emoji="📋" text="Document clinician observations in the session form" />
            <CheckItem emoji="📏" text="Enter validated PHQ-9 / GAD-7 / PSS-10 scale scores if collected manually" />
            <CheckItem emoji="📄" text="Generate clinical report and save to patient record" />
            <CheckItem emoji="📅" text="Schedule follow-up consultation if risk level is medium or above" />
            <CheckItem emoji="🔔" text="Trigger alert if VocoScale™ flags high / crisis tier — do not dismiss without review" />
          </ul>
        </Section>
      </motion.div>

      <motion.div variants={item}>
        <Section icon={AlertTriangle} iconColor="text-red-600" title="🆘 Crisis Protocol">
          <p className="text-gray-700 mb-4">
            If a patient expresses suicidal ideation, self-harm intent, or scores in the <strong>crisis tier</strong>:
          </p>
          <ul className="space-y-2">
            <CheckItem emoji="🛑" text="Stop the assessment immediately and attend to the patient" />
            <CheckItem emoji="📞" text="Contact the patient's emergency contact if consented" />
            <CheckItem emoji="🏥" text="Refer to iCall / NIMHANS / local crisis line as appropriate" />
            <CheckItem emoji="🔴" text="Manually trigger a Crisis Alert from the Alerts page" />
            <CheckItem emoji="📝" text="Document the incident fully — include time, trigger, and intervention taken" />
            <CheckItem emoji="📬" text="Notify Cittaa clinical supervisor within 24 hours" />
          </ul>
        </Section>
      </motion.div>

      <motion.div variants={item}>
        <Section icon={ShieldCheck} iconColor="text-gray-500" title="🔒 Data & Confidentiality">
          <ul className="space-y-2">
            <CheckItem emoji="🔐" text="Never share patient data outside the Vocalysis platform" />
            <CheckItem emoji="🙈" text="Anonymise patient details in any external communications" />
            <CheckItem emoji="📵" text="Do not screen-record or photograph patient sessions" />
            <CheckItem emoji="🗓️" text="Session data is retained for 5 years per DPDPA guidelines" />
          </ul>
        </Section>
      </motion.div>

    </motion.div>
  </div>
)

export default ProtocolGuide
