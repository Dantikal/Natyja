import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LanguageContext';

export default function SoldierForm({ onSaved, onCancel, editing }) {
  const { t } = useLang();
  const [ranks, setRanks] = useState([]);
  const [positions, setPositions] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [militaryUnits, setMilitaryUnits] = useState([]);

  const [form, setForm] = useState({
    fullName: '',
    rankId: '',
    positionId: '',
    unitId: '',
    yearsOfService: 0,
    reprimands: 0,
    characteristic: '',
    worksPercent: 0,
    shiftsPercent: 0,
  });

  const [showAdd, setShowAdd] = useState({ ranks: false, positions: false, militaryUnits: false });
  const [newVal, setNewVal] = useState({ ranks: '', positions: '', militaryUnits: '', location: '' });

  useEffect(() => {
    loadAll();
    if (editing) {
      setForm({
        fullName: editing.full_name || '',
        rankId: editing.rank_id || '',
        positionId: editing.position_id || '',
        unitId: editing.unit_id || '',
        yearsOfService: editing.years_of_service || 0,
        reprimands: editing.reprimands || 0,
        characteristic: editing.characteristic || '',
        worksPercent: editing.works_percent || 0,
        shiftsPercent: editing.shifts_percent || 0,
      });
      setPhoto(null);
      setPhotoPreview(editing.photo_file ? `/uploads/${editing.photo_file}` : '');
    } else {
      setPhoto(null);
      setPhotoPreview('');
    }
  }, [editing]);

  async function loadAll() {
    try {
      const [r, p, mu] = await Promise.all([
        api.get('/dictionaries/ranks'),
        api.get('/dictionaries/positions'),
        api.get('/dictionaries/military-units'),
      ]);
      setRanks(r.data);
      setPositions(p.data);
      setMilitaryUnits(mu.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function addToDict(type) {
    const name = newVal[type].trim();
    if (!name) return;
    try {
      let payload = { name };
      if (type === 'ranks') payload = { name, category: 'гражданский' };
      if (type === 'militaryUnits') payload = { name, location: newVal.location.trim() };

      const res = await api.post(`/dictionaries/${type}`, payload);
      await loadAll();

      const fieldMap = { ranks: 'rankId', positions: 'positionId', militaryUnits: 'unitId' };
      setForm((prev) => ({ ...prev, [fieldMap[type]]: res.data.id }));
      setNewVal((prev) => ({ ...prev, [type]: '', location: '' }));
      setShowAdd((prev) => ({ ...prev, [type]: false }));
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      let soldierId;
      if (editing) {
        await api.put(`/soldiers/${editing.id}`, form);
        soldierId = editing.id;
      } else {
        const response = await api.post('/soldiers', form);
        soldierId = response.data.id;
      }
      if (photo) {
        const photoData = new FormData();
        photoData.append('photo', photo);
        await api.post(`/soldiers/${soldierId}/photo`, photoData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      onSaved?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  }

  const useful = Math.max(0, form.worksPercent - form.shiftsPercent - form.reprimands * 5);

  return (
    <div className="form-overlay">
      <form className="soldier-form" onSubmit={submit}>
        <h2>{editing ? t('formEditTitle') : t('formAddTitle')}</h2>

        <label>
          {t('fullName')} *
          <input
            value={form.fullName}
            required
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </label>

        <label>
          {t('photoFile')}
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
            <img src={photoPreview} alt={t('photoPreview')} style={{ maxWidth: 120, borderRadius: 8 }} />
          </div>
        )}

        <div className="field-add">
          <label>
            {t('militaryRank')}
            <select value={form.rankId} onChange={(e) => setForm({ ...form, rankId: e.target.value })}>
              <option value="">{t('selectPlaceholder')}</option>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-plus"
            onClick={() => setShowAdd({ ...showAdd, ranks: !showAdd.ranks })}>+</button>
        </div>
        {showAdd.ranks && (
          <div className="inline-add">
            <input
              placeholder={t('newRankPlaceholder')}
              value={newVal.ranks}
              onChange={(e) => setNewVal({ ...newVal, ranks: e.target.value })}
            />
            <button type="button" onClick={() => addToDict('ranks')}>{t('addToDict')}</button>
          </div>
        )}

        <div className="field-add">
          <label>
            {t('position')}
            <select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}>
              <option value="">{t('selectPlaceholder')}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-plus"
            onClick={() => setShowAdd({ ...showAdd, positions: !showAdd.positions })}>+</button>
        </div>
        {showAdd.positions && (
          <div className="inline-add">
            <input
              placeholder={t('newPositionPlaceholder')}
              value={newVal.positions}
              onChange={(e) => setNewVal({ ...newVal, positions: e.target.value })}
            />
            <button type="button" onClick={() => addToDict('positions')}>{t('addToDict')}</button>
          </div>
        )}

        <div className="field-add">
          <label>
            {t('militaryUnit')}
            <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              <option value="">{t('selectPlaceholder')}</option>
              {militaryUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-plus"
            onClick={() => setShowAdd({ ...showAdd, militaryUnits: !showAdd.militaryUnits })}>+</button>
        </div>
        {showAdd.militaryUnits && (
          <div className="inline-add" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <input
              placeholder={t('newUnitNamePlaceholder')}
              value={newVal.militaryUnits}
              onChange={(e) => setNewVal({ ...newVal, militaryUnits: e.target.value })}
            />
            <input
              placeholder={t('newUnitLocationPlaceholder')}
              value={newVal.location}
              onChange={(e) => setNewVal({ ...newVal, location: e.target.value })}
              style={{ marginTop: 6 }}
            />
            <button type="button" style={{ marginTop: 6 }} onClick={() => addToDict('militaryUnits')}>
              {t('addToDict')}
            </button>
          </div>
        )}

        <label>
          {t('serviceYears')}
          <input
            type="number"
            min="0"
            value={form.yearsOfService}
            onChange={(e) => setForm({ ...form, yearsOfService: +e.target.value })}
          />
        </label>

        <label>
          {t('reprimandsPerYear')}
          <input
            type="number"
            min="0"
            value={form.reprimands}
            onChange={(e) => setForm({ ...form, reprimands: +e.target.value })}
          />
        </label>

        <label>
          {t('characteristic')}
          <textarea
            rows="4"
            placeholder={t('characteristicPlaceholder')}
            value={form.characteristic}
            onChange={(e) => setForm({ ...form, characteristic: e.target.value })}
          />
        </label>

        <div className="two-cols">
          <label>
            {t('worksPercent')}
            <input type="number" min="0" max="100"
              value={form.worksPercent}
              onChange={(e) => setForm({ ...form, worksPercent: +e.target.value })} />
          </label>

          <label>
            {t('shiftsPercent')}
            <input type="number" min="0" max="100"
              value={form.shiftsPercent}
              onChange={(e) => setForm({ ...form, shiftsPercent: +e.target.value })} />
          </label>
        </div>

        <div className="preview">
          {t('finalUseful')}: <b>{useful}%</b>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {t('formula')}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary">
            {editing ? t('save') : t('add')}
          </button>
        </div>
      </form>
    </div>
  );
}