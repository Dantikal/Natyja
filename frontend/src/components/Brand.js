import { useLang } from '../context/LanguageContext';
import borderServiceEmblem from '../assets/border-service-emblem.webp';

export default function Brand({ large = false }) {
  const { t } = useLang();
  const serviceEmblem = <img className="brand-service-emblem" src={borderServiceEmblem} alt="Эмблема Пограничной службы Кыргызской Республики" width="378" height="462" />;
  if (large) return <span className="brand brand-large brand-pair"><img className="brand-lockup" src="/natyyzha-1-logo.webp" alt={t('appName')} width="330" height="220" />{serviceEmblem}</span>;
  return <span className={`brand ${large ? 'brand-large' : ''}`}>
    <span className="brand-emblem-pair">{serviceEmblem}
    <img className="brand-emblem" src="/natyyzha-emblem.webp" alt="" width="50" height="50" />
    </span>
    <span className="brand-wordmark"><span className="brand-name">{t('appName')}</span><span className="brand-caption">{t('loginSubtitle')}</span></span>
  </span>;
}
