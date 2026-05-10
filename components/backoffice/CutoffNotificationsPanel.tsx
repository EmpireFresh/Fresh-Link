"use client"

import { useState } from "react"
import { store, CutoffNotification, UserRole, ROLE_LABELS, DEFAULT_CUTOFFS } from "@/lib/store"
import { Bell, Plus, Trash2, Save, Clock } from "lucide-react"

const ELIGIBLE_ROLES: UserRole[] = ["acheteur", "livreur", "prevendeur", "magasinier", "dispatcheur", "ctrl_achat", "ctrl_prep"]

export default function CutoffNotificationsPanel() {
  const [cutoffs, setCutoffs] = useState<CutoffNotification[]>(() => store.getCutoffs())
  const [editing, setEditing] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState<Partial<CutoffNotification>>({ time: "09:00", message: "", active: true, roles: ["acheteur"] })
  const [saved, setSaved] = useState(false)

  const update = (id: string, updates: Partial<CutoffNotification>) => {
    setCutoffs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const toggleRole = (id: string, role: UserRole) => {
    const c = cutoffs.find(c => c.id === id)
    if (!c) return
    const has = c.roles.includes(role)
    update(id, { roles: has ? c.roles.filter(r => r !== role) : [...c.roles, role] })
  }

  const save = () => {
    store.saveCutoffs(cutoffs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const remove = (id: string) => setCutoffs(prev => prev.filter(c => c.id !== id))

  const add = () => {
    if (!newForm.time || !newForm.message) return
    const nc: CutoffNotification = {
      id: store.genId(),
      time: newForm.time!,
      message: newForm.message!,
      active: newForm.active ?? true,
      roles: newForm.roles ?? ["acheteur"],
    }
    setCutoffs(prev => [...prev, nc])
    setNewForm({ time: "09:00", message: "", active: true, roles: ["acheteur"] })
    setShowAdd(false)
  }

  const toggleNewRole = (role: UserRole) => {
    const has = (newForm.roles ?? []).includes(role)
    setNewForm(f => ({ ...f, roles: has ? (f.roles ?? []).filter(r => r !== role) : [...(f.roles ?? []), role] }))
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4" style={{ background: "#080c14" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: "#f1f5f9" }}>Notifications Cut-off</p>
          <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>Configurez les rappels automatiques envoyés aux utilisateurs mobiles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#1d4ed8" }}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
          <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: saved ? "#0d2e18" : "#0f1623", color: saved ? "#6ee7b7" : "#e2e8f0", border: `1px solid ${saved ? "#15352a" : "#1a2535"}` }}>
            <Save className="w-3.5 h-3.5" /> {saved ? "Sauvegardé !" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {cutoffs.map(c => (
          <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: "#0f1623", border: `1px solid ${c.active ? "#1d3a5e" : "#1a2535"}` }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #1a2535" }}>
              <Clock className="w-4 h-4 flex-shrink-0" style={{ color: c.active ? "#60a5fa" : "#374151" }} />
              <input
                type="time"
                value={c.time}
                onChange={e => update(c.id, { time: e.target.value })}
                className="text-sm font-bold outline-none bg-transparent"
                style={{ color: c.active ? "#f1f5f9" : "#4b5563" }}
              />
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => update(c.id, { active: !c.active })}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors"
                  style={{ background: c.active ? "#3b82f6" : "#374151" }}
                >
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform" style={{ transform: c.active ? "translateX(18px)" : "translateX(2px)", marginTop: "2px" }} />
                </button>
                <span className="text-[10px]" style={{ color: c.active ? "#60a5fa" : "#374151" }}>{c.active ? "Actif" : "Inactif"}</span>
                <button onClick={() => remove(c.id)} className="p-1 rounded-lg" style={{ background: "#1c0a0a", border: "1px solid #3b1515" }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Message */}
              <div>
                <p className="text-[10px] mb-1" style={{ color: "#4b5563" }}>Message de notification</p>
                <textarea
                  value={c.message}
                  onChange={e => update(c.id, { message: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
                  style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }}
                />
              </div>
              {/* Roles */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: "#4b5563" }}>Destinataires</p>
                <div className="flex flex-wrap gap-1.5">
                  {ELIGIBLE_ROLES.map(r => {
                    const has = c.roles.includes(r)
                    return (
                      <button
                        key={r}
                        onClick={() => toggleRole(c.id, r)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
                        style={{
                          background: has ? "#1d4ed822" : "#0a0f18",
                          color: has ? "#60a5fa" : "#374151",
                          border: `1px solid ${has ? "#1d4ed844" : "#1a2535"}`,
                        }}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}

        {cutoffs.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: "#1a2535" }} />
            <p className="text-xs" style={{ color: "#374151" }}>Aucune notification configurée</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "#0f1623", border: "1px solid #1a2535" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #1a2535" }}>
              <p className="font-bold text-sm" style={{ color: "#f1f5f9" }}>Nouvelle Notification Cut-off</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs mb-1" style={{ color: "#4b5563" }}>Heure</p>
                <input type="time" value={newForm.time} onChange={e => setNewForm(f => ({ ...f, time: e.target.value }))} className="px-3 py-2 rounded-xl text-sm font-bold outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#4b5563" }}>Message</p>
                <textarea value={newForm.message} onChange={e => setNewForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Contenu du message de rappel..." className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
              </div>
              <div>
                <p className="text-xs mb-1.5" style={{ color: "#4b5563" }}>Destinataires</p>
                <div className="flex flex-wrap gap-1.5">
                  {ELIGIBLE_ROLES.map(r => {
                    const has = (newForm.roles ?? []).includes(r)
                    return (
                      <button key={r} onClick={() => toggleNewRole(r)} className="px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: has ? "#1d4ed822" : "#0a0f18", color: has ? "#60a5fa" : "#374151", border: `1px solid ${has ? "#1d4ed844" : "#1a2535"}` }}>
                        {ROLE_LABELS[r]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button onClick={add} className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#1d4ed8" }}>
                Ajouter Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
