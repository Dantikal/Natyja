import { useLang } from "../context/LanguageContext";
import Brand from '../components/Brand';
import Captcha from '../components/Captcha';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
export default function Register() {
  const {
    tr, lang, toggleLang
  } = useLang();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    rankId: '',
    positionId: '',
    unitId: '',
    customRank: '',customPosition: '',customUnit: '',
    requestedRole: 'user'
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [ranks, setRanks] = useState([]);
  const [positions, setPositions] = useState([]);
  const [militaryUnits, setMilitaryUnits] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState({ id: '', answer: '' });
  const [captchaReset, setCaptchaReset] = useState(0);
  const {
    register
  } = useAuth();
  const navigate = useNavigate();

  // Загружаем справочники — но нужен публичный endpoint (без авторизации)
  useEffect(() => {
    loadDictionaries();
  }, []);
  async function loadDictionaries() {
    try {
      // Публичные endpoint'ы для регистрации
      const [r, p, u] = await Promise.all([api.get('/public/ranks'), api.get('/public/positions'), api.get('/public/military-units')]);
      setRanks(r.data);
      setPositions(p.data);
      setMilitaryUnits(u.data);
    } catch (err) {
      console.error('Не удалось загрузить справочники:', err);
    }
  }
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Проверка размера — 5 МБ
    if (file.size > 5 * 1024 * 1024) {
      setError(tr("Фото не должно превышать 5 МБ"));
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
    setError('');
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!captcha.id || captcha.answer.length !== 6 || loading) return;
    setError('');

    // Проверки
    if (!photo) {
      setError(tr("Загрузите фото"));
      return;
    }
    if (![['rankId','customRank'],['positionId','customPosition'],['unitId','customUnit']].every(([id,text])=>form[id]&&(form[id]!=='__custom__'||form[text].trim()))) {
      setError(tr("Укажите звание, должность и войсковую часть"));
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('fullName', form.fullName);
      formData.append('email', form.email);
      formData.append('password', form.password);
      for(const [id,text]of [['rankId','customRank'],['positionId','customPosition'],['unitId','customUnit']]){formData.append(id,form[id]==='__custom__'?'':form[id]);if(form[id]==='__custom__')formData.append(text,form[text].trim());}
      formData.append('requestedRole', form.requestedRole);
      formData.append('photo', photo);
      await register(formData, captcha);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setCaptchaReset(n => n + 1);
      setError(err.response?.data?.error || tr("Ошибка регистрации"));
    } finally {
      setLoading(false);
    }
  }
  if (success) {
    return <div className="auth-page">
        <div className="auth-box">
          <div className="auth-brand"><Brand large /></div>
          <h1>{tr("Заявка отправлена")}</h1>
          <p className="success-text">{tr("Ваша заявка на регистрацию отправлена.")}<br />{tr("Ожидайте одобрения администратора.")}</p>
          <p className="auth-footer">{tr("Сейчас вас перенаправит на страницу входа...")}</p>
        </div>
      </div>;
  }
  return <div className="auth-page">
      <div className="auth-box auth-box-wide">
        <div className="auth-brand"><Brand large /></div>
        <div className="auth-lang-switch"><button type="button" onClick={toggleLang}>{lang === 'ru' ? 'КЫ' : 'РУ'}</button></div>
        <h1>{tr("Регистрация")}</h1>
        <p className="auth-subtitle">{tr("Заполните данные для получения доступа")}</p>

        <form onSubmit={handleSubmit}>
          <label>{tr("ФИО *")}<input type="text" value={form.fullName} onChange={e => setForm({
            ...form,
            fullName: e.target.value
          })} placeholder={tr("Иванов Иван Иванович")} required />
          </label>

          <label>
            Email *
            <input type="email" value={form.email} onChange={e => setForm({
            ...form,
            email: e.target.value
          })} required />
          </label>

          <label>{tr("Пароль * (мин. 8 символов)")}<input type="password" value={form.password} onChange={e => setForm({
            ...form,
            password: e.target.value
          })} minLength={8} required />
          </label>

          {[['rankId','customRank','Воинское звание *',ranks],['positionId','customPosition','Должность *',positions],['unitId','customUnit','Войсковая часть *',militaryUnits]].map(([id,text,title,options])=><DictionaryChoice key={id} id={id} title={title} value={form[id]} custom={form[text]} options={options} onSelect={value=>setForm(prev=>({...prev,[id]:value}))} onCustom={value=>setForm(prev=>({...prev,[text]:value}))} />)}
          <p className="account-help">{tr('Введённые вручную данные проверит администратор.')}</p>

          <label>{tr("Кем хотите быть *")}<select value={form.requestedRole} onChange={e => setForm({
            ...form,
            requestedRole: e.target.value
          })}>
              <option value="user">{tr("Военнослужащий")}</option>
              <option value="commander">{tr("Командир части")}</option>
            </select>
          </label>

          <label>{tr("Фото * (JPG, PNG, до 5 МБ)")}<input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoChange} required />
          </label>

          {photoPreview && <div className="photo-preview-block">
              <img src={photoPreview} alt={tr("Превью")} className="photo-preview-img" />
              <button type="button" className="btn-small btn-danger" onClick={() => {
            setPhoto(null);
            setPhotoPreview(null);
          }}>{tr("Удалить фото")}</button>
            </div>}

          <Captcha purpose="register" value={captcha} onChange={setCaptcha} resetKey={captchaReset} disabled={loading} />
          {error && <div className="error-msg" role="alert">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || !captcha.id || captcha.answer.length !== 6}>
            {loading ? tr("Отправка...") : tr("Отправить заявку")}
          </button>
        </form>

        <p className="auth-footer">{tr("Уже есть аккаунт?")}<Link to="/login">{tr("Войти")}</Link>
        </p>
      </div>
    </div>;
}

function DictionaryChoice({id,title,value,custom,options,onSelect,onCustom}){
 const {tr}=useLang();return <div className="registration-choice"><label htmlFor={'registration-'+id}>{tr(title)}</label><select id={'registration-'+id} value={value} onChange={e=>onSelect(e.target.value)} required><option value="">{tr('— выберите —')}</option>{options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}<option value="__custom__">{tr('Не нашёл — ввести вручную')}</option></select>{value==='__custom__'&&<label className="custom-dictionary-label">{tr('Своё значение')}<input type="text" value={custom} onChange={e=>onCustom(e.target.value)} required maxLength={100} placeholder={tr('Введите название')} /></label>}</div>;
}
