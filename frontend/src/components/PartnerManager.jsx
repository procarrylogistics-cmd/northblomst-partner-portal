import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

export default function PartnerManager() {
  const [partners, setPartners] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    zoneRanges: '',
    password: ''
  });

  const load = async () => {
    const res = await axios.get(`${API_BASE}/partners`);
    setPartners(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      zoneRanges: '',
      password: ''
    });
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      email: p.email,
      phone: p.phone || '',
      address: p.address || '',
      zoneRanges: (p.zoneRanges || []).join(','),
      password: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      zoneRanges: form.zoneRanges
        .split(',')
        .map((z) => z.trim())
        .filter(Boolean),
      password: form.password || undefined
    };

    if (editing) {
      await axios.put(`${API_BASE}/partners/${editing.id || editing._id}`, payload);
    } else {
      if (!form.password) return;
      await axios.post(`${API_BASE}/partners`, { ...payload, password: form.password });
    }

    await load();
    startNew();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Slet partner "${p.name}"? Ordre tildeling vil blive fjernet.`)) return;
    try {
      await axios.delete(`${API_BASE}/partners/${p._id}`);
      await load();
      if (editing?._id === p._id) startNew();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="partner-manager">
      <h3>Partnere</h3>
      <div className="partner-list">
        {partners.map((p) => (
          <div key={p._id} className="partner-list-item">
            <button type="button" onClick={() => startEdit(p)} className="partner-name-btn">
              {p.name} ({p.zoneRanges?.join(', ')})
            </button>
            <button type="button" onClick={() => handleDelete(p)} className="btn-delete" title="Slet">
              Slet
            </button>
          </div>
        ))}
        {partners.length === 0 && <div className="empty">Ingen partnere endnu</div>}
      </div>
      <div className="partner-form">
        <h4>{editing ? 'Rediger partner' : 'Ny partner'}</h4>
        <form onSubmit={handleSubmit}>
          <label>
            Navn
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              readOnly={!!editing}
            />
          </label>
          <label>
            Telefon
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            Adresse
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label>
            Zonerkort (f.eks. 1000-2999,4600)
            <input
              value={form.zoneRanges}
              onChange={(e) => setForm({ ...form, zoneRanges: e.target.value })}
            />
          </label>
          <label>
            Adgangskode {editing && <span>(tom = uændret)</span>}
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
              placeholder={editing ? 'Lad stå tom for uændret' : ''}
            />
          </label>
          <button type="submit">
            {editing ? 'Gem ændringer' : 'Opret partner'}
          </button>
        </form>
      </div>
    </div>
  );
}

