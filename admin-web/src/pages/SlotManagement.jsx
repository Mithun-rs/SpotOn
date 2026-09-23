import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Car, 
  Lock, 
  Wrench, 
  Search, 
  LayoutGrid, 
  Table as TableIcon, 
  Plus, 
  X, 
  SquareParking,
  Check,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../config/supabase';

const STATUS_CONFIG = {
  AVAILABLE:   { label: 'Available',   cls: 'available',   badge: 'badge-green',  icon: CheckCircle2 },
  OCCUPIED:    { label: 'Occupied',    cls: 'occupied',    badge: 'badge-red',    icon: Car },
  RESERVED:    { label: 'Reserved',    cls: 'reserved',    badge: 'badge-amber',  icon: Lock },
  MAINTENANCE: { label: 'Maintenance', cls: 'maintenance', badge: 'badge-gray',   icon: Wrench },
};

export default function SlotManagement() {
  const [slots, setSlots]             = useState([]);
  const [locations, setLocations]     = useState([]);
  const [selectedLoc, setSelectedLoc] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [viewMode, setViewMode]       = useState('grid'); // 'grid' | 'table'
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlot, setNewSlot]         = useState({ slot_number: '', location_id: '', floor: '', section: '' });
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchAll = async () => {
    try {
      const [{ data: s }, { data: l }] = await Promise.all([
        supabase.from('parking_slots').select('*, parking_locations(name)').order('slot_number'),
        supabase.from('parking_locations').select('*'),
      ]);
      setSlots(s || []);
      setLocations(l || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const sub = supabase.channel('slots-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const toggleStatus = async (slot) => {
    const next = slot.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
    const { error } = await supabase.from('parking_slots').update({ status: next }).eq('slot_id', slot.slot_id);
    if (!error) { showToast(`Slot ${slot.slot_number} → ${next}`); fetchAll(); }
    else showToast('Update failed');
  };

  const deleteSlot = async (slot) => {
    if (!window.confirm(`Delete slot ${slot.slot_number}?`)) return;
    await supabase.from('parking_slots').delete().eq('slot_id', slot.slot_id);
    showToast(`Slot ${slot.slot_number} deleted`);
    fetchAll();
  };

  const addSlot = async () => {
    if (!newSlot.slot_number || !newSlot.location_id) return;
    setSaving(true);
    const { error } = await supabase.from('parking_slots').insert({
      slot_number: newSlot.slot_number,
      location_id: Number(newSlot.location_id),
      floor:       newSlot.floor || null,
      section:     newSlot.section || null,
      status:      'AVAILABLE',
    });
    setSaving(false);
    if (!error) { showToast(`Slot ${newSlot.slot_number} added`); setShowAddModal(false); setNewSlot({ slot_number:'', location_id:'', floor:'', section:'' }); fetchAll(); }
    else showToast('Failed to add slot');
  };

  const filtered = slots.filter(s => {
    const locOk    = selectedLoc === 'all' || String(s.location_id) === selectedLoc;
    const statusOk = filterStatus === 'all' || s.status === filterStatus;
    const searchOk = !search || s.slot_number?.toLowerCase().includes(search.toLowerCase());
    return locOk && statusOk && searchOk;
  });

  const counts = {
    available:   slots.filter(s => s.status === 'AVAILABLE').length,
    occupied:    slots.filter(s => s.status === 'OCCUPIED').length,
    reserved:    slots.filter(s => s.status === 'RESERVED').length,
    maintenance: slots.filter(s => s.status === 'MAINTENANCE').length,
  };

  return (
    <div className="page-body">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0F172A', color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div className="page-header-text">
          <h1>Slot Management</h1>
          <p>{slots.length} total slots across {locations.length} locations</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewMode(v => v === 'grid' ? 'table' : 'grid')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {viewMode === 'grid' ? <><TableIcon size={16} /> Table View</> : <><LayoutGrid size={16} /> Grid View</>}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Slot
          </button>
        </div>
      </div>

      {/* Summary Pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([k, v]) => {
          const cfg = STATUS_CONFIG[k.toUpperCase()];
          const IconComp = cfg?.icon;
          return (
            <div key={k} className={`badge badge-${k === 'available' ? 'green' : k === 'occupied' ? 'red' : k === 'reserved' ? 'amber' : 'gray'}`} style={{ fontSize: 13, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {IconComp && <IconComp size={14} />} {v} {k.charAt(0).toUpperCase() + k.slice(1)}
            </div>
          );
        })}
      </div>

      <div className="card">
        {/* Filters */}
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}><Search size={16} color="#94A3B8" /></span>
            <input className="form-input" placeholder="Search slot number…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 180 }} value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
            <option value="all">All Locations</option>
            {locations.map(l => <option key={l.location_id} value={String(l.location_id)}>{l.name}</option>)}
          </select>
          {['all','AVAILABLE','OCCUPIED','RESERVED','MAINTENANCE'].map(s => (
            <button key={s} className={`filter-pill${filterStatus === s ? ' active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading slots…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><SquareParking size={32} color="#94A3B8" /></div>
            <p>No slots match the filter.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="slot-grid">
            {filtered.map(slot => {
              const cfg = STATUS_CONFIG[slot.status] || STATUS_CONFIG.AVAILABLE;
              const IconComp = cfg.icon;
              return (
                <div
                  key={slot.slot_id}
                  className={`slot-cell ${cfg.cls}`}
                  title={`${slot.slot_number} — ${cfg.label}\nClick to toggle`}
                  onClick={() => toggleStatus(slot)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span className="slot-cell-icon" style={{ display: 'inline-flex' }}><IconComp size={16} /></span>
                  <span>{slot.slot_number}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Slot #</th>
                  <th>Location</th>
                  <th>Floor</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(slot => {
                  const cfg = STATUS_CONFIG[slot.status] || STATUS_CONFIG.AVAILABLE;
                  const IconComp = cfg.icon;
                  return (
                    <tr key={slot.slot_id}>
                      <td><strong>{slot.slot_number}</strong></td>
                      <td>{slot.parking_locations?.name || '—'}</td>
                      <td>{slot.floor || '—'}</td>
                      <td>{slot.section || '—'}</td>
                      <td>
                        <span className={`badge ${cfg.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <IconComp size={12} /> {cfg.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => toggleStatus(slot)}>Toggle</button>
                          <button className="btn btn-danger btn-xs" onClick={() => deleteSlot(slot)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Slot Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add New Parking Slot</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Slot Number *</label>
                <input className="form-input" placeholder="e.g. A-101" value={newSlot.slot_number} onChange={e => setNewSlot(p => ({ ...p, slot_number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Location *</label>
                <select className="form-input" value={newSlot.location_id} onChange={e => setNewSlot(p => ({ ...p, location_id: e.target.value }))}>
                  <option value="">Select location</option>
                  {locations.map(l => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <input className="form-input" placeholder="e.g. G, 1, 2" value={newSlot.floor} onChange={e => setNewSlot(p => ({ ...p, floor: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Section</label>
                  <input className="form-input" placeholder="e.g. A, B, C" value={newSlot.section} onChange={e => setNewSlot(p => ({ ...p, section: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addSlot} disabled={saving}>{saving ? 'Saving…' : 'Add Slot'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

