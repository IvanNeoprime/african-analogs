import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, CloudUpload, HardDrive, Link2, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';

export interface SaveState {
  sampleId: string;
  /** ISO time of the save. */
  at: string;
  /** local = only this browser · pending = publishing · ok = in the shared database · error = server failed */
  remote: 'local' | 'pending' | 'ok' | 'error';
  message?: string;
}

/** Re-renders every 30 s so "há 2 min" stays current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function relativeTime(iso: string, now: number, t: (pt: string, en: string) => string, locale: string): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return t('agora mesmo', 'just now');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t(`há ${minutes} min`, `${minutes} min ago`);
  const clock = new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return t(`às ${clock}`, `at ${clock}`);
}

/** Tells the person where their data went, right under the save button. */
export const SaveIndicator: React.FC<{ saveState?: SaveState | null; sampleId: string; isSignedIn: boolean }> = ({
  saveState,
  sampleId,
  isSignedIn,
}) => {
  const now = useNow();
  const { t, locale } = useI18n();
  if (!saveState || saveState.sampleId !== sampleId) {
    return (
      <p className="text-xs text-[#64748B] dark:text-[#8B949E]">
        {isSignedIn
          ? t('Ao guardar, o estudo é publicado na comunidade com o seu nome.', 'When you save, the study is published to the community under your name.')
          : t('Sem conta, os dados ficam só neste navegador. Entre para os publicar.', 'Without an account, data stays in this browser only. Sign in to publish it.')}
      </p>
    );
  }
  const when = relativeTime(saveState.at, now, t, locale);
  const base = 'text-xs flex items-center gap-1.5';
  switch (saveState.remote) {
    case 'pending':
      return (
        <p role="status" className={`${base} text-[#475569] dark:text-[#94A3B8]`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} aria-hidden="true" /> {t('A publicar na comunidade…', 'Publishing to the community…')}
        </p>
      );
    case 'ok':
      return (
        <p role="status" className={`${base} text-[#15803D] dark:text-[#4ADE80]`}>
          <CloudUpload className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" /> {t('Publicado na comunidade', 'Published to the community')} {when}
        </p>
      );
    case 'error':
      return (
        <p role="alert" className={`${base} text-[#B91C1C] dark:text-[#F87171]`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {t('Guardado neste navegador', 'Saved in this browser')} {when}, {t('mas não foi publicado', 'but not published')}: {saveState.message || t('erro no servidor', 'server error')}.
        </p>
      );
    default:
      return (
        <p role="status" className={`${base} text-[#475569] dark:text-[#94A3B8]`}>
          <HardDrive className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" /> {t('Guardado neste navegador', 'Saved in this browser')} {when}.{' '}
          {t('Entre na sua conta para publicar.', 'Sign in to publish.')}
        </p>
      );
  }
};

interface ResearchStepsProps {
  isExample: boolean;
  sampleId: string;
  hasMinerals: boolean;
  saveState?: SaveState | null;
  isSignedIn: boolean;
  onGoToSample: () => void;
  onGoToResult: () => void;
  onGoToShare: () => void;
  /** Shareable address of the study, once published. */
  studyLink: string | null;
}

/**
 * The three-step path through the research page: describe the sample, read the result,
 * share it. Each step shows whether it is done and jumps to its section.
 */
export const ResearchSteps: React.FC<ResearchStepsProps> = ({
  isExample,
  sampleId,
  hasMinerals,
  saveState,
  isSignedIn,
  onGoToSample,
  onGoToResult,
  onGoToShare,
  studyLink,
}) => {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const savedThis = Boolean(saveState && saveState.sampleId === sampleId);
  const published = savedThis && saveState!.remote === 'ok';

  const steps = [
    {
      n: 1,
      title: t('Amostra', 'Sample'),
      hint: isExample
        ? t('Comece do zero ou edite o exemplo', 'Start from scratch or edit the example')
        : hasMinerals
        ? t('Dados preenchidos', 'Data filled in')
        : t('Indique minerais, aw e pH', 'Enter minerals, aw and pH'),
      done: savedThis && hasMinerals,
      onClick: onGoToSample,
    },
    {
      n: 2,
      title: t('Resultado', 'Result'),
      hint: savedThis ? t('Veja a semelhança e os gráficos', 'See the similarity and the charts') : t('Aparece depois de guardar', 'Appears after saving'),
      done: savedThis,
      onClick: onGoToResult,
    },
    {
      n: 3,
      title: t('Partilhar', 'Share'),
      hint: published
        ? t('Publicado na comunidade', 'Published to the community')
        : isSignedIn
        ? t('Guarde para publicar', 'Save to publish')
        : t('Entre na conta para publicar', 'Sign in to publish'),
      done: published,
      onClick: onGoToShare,
    },
  ];
  const current = steps.find((s) => !s.done)?.n ?? 3;

  return (
    <nav aria-label={t('Passos da análise', 'Analysis steps')} className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-3 sm:p-4 shadow-xs">
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((s) => {
          const isCurrent = s.n === current && !s.done;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={s.onClick}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-full h-full text-left flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${
                  isCurrent ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/25' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#0D1117]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.done
                      ? 'bg-[#15803D] text-[#FFFFFF]'
                      : isCurrent
                      ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                      : 'bg-[#E2E8F0] dark:bg-[#30363D] text-[#475569] dark:text-[#94A3B8]'
                  }`}
                >
                  {s.done ? <Check className="w-4 h-4" strokeWidth={2.5} /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                    {s.title}
                    <span className="sr-only">{s.done ? t(' (concluído)', ' (done)') : isCurrent ? t(' (passo atual)', ' (current step)') : ''}</span>
                  </span>
                  <span className="hidden sm:block text-xs text-[#475569] dark:text-[#94A3B8] truncate">{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {studyLink && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs">
          <span className="text-[#15803D] dark:text-[#4ADE80]">{t('Estudo publicado.', 'Study published.')}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(studyLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            }}
            className="py-1.5 px-3 rounded-lg bg-[#F1F5F9] dark:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] font-medium flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <Link2 className="w-3.5 h-3.5" strokeWidth={2} />}
            <span aria-live="polite">{copied ? t('Link copiado', 'Link copied') : t('Copiar link para partilhar', 'Copy link to share')}</span>
          </button>
        </div>
      )}
    </nav>
  );
};
