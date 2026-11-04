import ProfileOverview from '../components/ProfileOverview';
import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { t, tr } = useLang();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get('/soldiers/me');
      setProfile(res.data);
      setPhotoPreview(res.data.photo_file ? `/uploads/${res.data.photo_file}` : '');
      setForm({
        fullName: res.data.full_name || '',
      });
    } catch (err) {
      setError(err.response?.data?.error || t('loadingError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (photo) {
        const photoData = new FormData();
        photoData.append('photo', photo);
        await api.post('/soldiers/me/photo', photoData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await api.patch('/soldiers/me', form);
      setPhoto(null);
      setEditing(false);
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.error || t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="container"><p>{t('loading')}</p></div>;

  if (error && !profile) {
    return (
      <div className="container">
        <h1>{t('navProfile')}</h1>
        <div className="empty-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container profile-home">
      <div className="page-title-row">
        <h1>{t('navProfile')}</h1>
      </div>

      {editing ? (
        <form className="soldier-form" onSubmit={handleSave} style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2>{t('formEditTitle')}</h2>

          <label>
            {t('fullName')}
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </label>

          <label>
            {t('profilePhoto')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setPhoto(file);
                if (file) setPhotoPreview(URL.createObjectURL(file));
              }}
            />
          </label>
          {photoPreview && (
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <img src={photoPreview} alt={t('photoPreview')} style={{ maxWidth: 120, borderRadius: 8, border: '2px solid #1e3a5f' }} />
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      ) : (
        <><ProfileOverview profile={profile} /><details className="profile-details profile-account-controls"><summary>{tr('Управление профилем')}</summary><div className="profile-header-actions"><button className="btn-secondary" onClick={()=>setEditing(true)}>{t('edit')}</button><Link className="btn-secondary" to="/change-password">{tr('Изменить пароль')}</Link></div></details></>
      )}
    </div>
  );
}
