"use client"

import { useState } from "react"
import {
  Archive, RotateCcw, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, Loader2, Database, CloudLightning, Info,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { useFirebaseArchive, type ArchivableTable } from "@/lib/firebase/useFirebaseArchive"

// ── Config des tables archivables ────────────────────────────

const TABLE_CONFIG: Array<{
  key: ArchivableTable
  label: string
  description: string
  icon: string
}> = [
  { key: "commandes",      label: "Commandes",         description: "Bons de commande clients",        icon: "📦" },
  { key: "bons_livraison", label: "Bons de livraison", description: "BLs signés et livrés",            icon: "🚚" },
  { key: "trips",          label: "Tournées",           description: "Historique des tournées livreurs", icon: "🗺️" },
  { key: "retours",        label: "Retours",            description: "Retours et avoirs clients",       icon: "↩️" },
  { key: "visites",        label: "Visites",            description: "Visites commerciales terrain",    icon: "👥" },
  { key: "clients",        label: "Clients",            description: "Fiches clients inactifs",         icon: "🤝" },
  { key: "articles",       label: "Articles",           description: "Catalogue produits archivés",     icon: "🥦" },
]

// ── Composant principal ───────────────────────────────────────

export default function BOFirebaseArchive() {
  const {
    configured, stats, loadingStats, operations,
    refreshStats, archive, restore, deleteArch,
  } = useFirebaseArchive()

  const [selectedTable, setSelectedTable] = useState<ArchivableTable>("commandes")
  const [olderThanMonths, setOlderThanMonths] = useState(6)
  const [deleteFromSource, setDeleteFromSource] = useState(false)
  const [restoreMax, setRestoreMax] = useState(500)
  const [activeTab, setActiveTab] = useState<"archive" | "restore" | "operations">("archive")
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<ArchivableTable | null>(null)
  const [running, setRunning] = useState(false)

  const currentStat = stats.find(s => s.table === selectedTable)

  async function handleArchive() {
    setRunning(true)
    await archive(selectedTable, olderThanMonths, deleteFromSource)
    setRunning(false)
  }

  async function handleRestore() {
    setRunning(true)
    await restore(selectedTable, restoreMax)
    setRunning(false)
  }

  async function handleDelete(table: ArchivableTable) {
    setConfirmDelete(null)
    setRunning(true)
    await deleteArch(table)
    setRunning(false)
  }

  if (!configured) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <CloudLightning className="text-orange-500" size={24} />
          <h2 className="text-xl font-bold text-gray-800">Archivage Firebase</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-500 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-amber-800">Firebase non configuré</p>
              <p className="text-sm text-amber-700 mt-1">
                Ajoutez les variables d&apos;environnement Firebase dans votre fichier{" "}
                <code className="bg-amber-100 px-1 rounded">.env.local</code> pour activer l&apos;archivage.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-amber-100 font-mono text-xs text-gray-700 space-y-1">
            <p className="text-gray-400"># Créez un projet sur console.firebase.google.com</p>
            <p>NEXT_PUBLIC_FIREBASE_API_KEY=<span className="text-blue-600">votre-api-key</span></p>
            <p>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<span className="text-blue-600">projet.firebaseapp.com</span></p>
            <p>NEXT_PUBLIC_FIREBASE_PROJECT_ID=<span className="text-blue-600">votre-projet-id</span></p>
            <p>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<span className="text-blue-600">projet.appspot.com</span></p>
            <p>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<span className="text-blue-600">123456789</span></p>
            <p>NEXT_PUBLIC_FIREBASE_APP_ID=<span className="text-blue-600">1:xxx:web:xxx</span></p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-amber-100 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Comment obtenir ces valeurs :</p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Allez sur <strong>console.firebase.google.com</strong></li>
              <li>Créez un nouveau projet (ou sélectionnez un existant)</li>
              <li>Ajoutez une application Web (icône &lt;/&gt;)</li>
              <li>Copiez la configuration affichée</li>
              <li>Activez <strong>Firestore Database</strong> dans le menu Build</li>
              <li>Choisissez le mode <strong>Production</strong> (région europe-west1)</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CloudLightning className="text-orange-500" size={22} />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Archivage Firebase</h2>
            <p className="text-sm text-gray-500">
              Archive les anciennes données Supabase vers Firestore pour libérer votre quota gratuit
            </p>
          </div>
        </div>
        <button
          onClick={refreshStats}
          disabled={loadingStats}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Bandeau info limites Supabase free */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          <strong>Limites Supabase Free :</strong> 500 MB base de données · 1 GB fichiers · 2 GB bande passante.
          Archivez les données de plus de 3-6 mois vers Firebase (gratuit jusqu&apos;à 1 GB) pour rester dans les limites.
        </p>
      </div>

      {/* Stats globales par table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Archives Firebase actuelles
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TABLE_CONFIG.map(({ key, label, icon }) => {
            const stat = stats.find(s => s.table === key)
            return (
              <button
                key={key}
                onClick={() => setSelectedTable(key)}
                className={`rounded-xl p-3 border text-left transition-all ${
                  selectedTable === key
                    ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300"
                    : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30"
                }`}
              >
                <span className="text-xl">{icon}</span>
                <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
                <p className="text-lg font-bold text-orange-600">
                  {loadingStats ? "…" : (stat?.count ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400">docs archivés</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Onglets action */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(["archive", "restore", "operations"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-orange-50 text-orange-700 border-b-2 border-orange-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab === "archive" && "↑ Archiver"}
              {tab === "restore" && "↓ Restaurer"}
              {tab === "operations" && `Journal (${operations.length})`}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Tab Archive ── */}
          {activeTab === "archive" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Déplace les anciennes données de <strong>Supabase → Firebase</strong>.
                Optionnellement les supprime de Supabase pour libérer de l&apos;espace.
              </p>

              {/* Sélection table */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table à archiver</label>
                <select
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value as ArchivableTable)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
                >
                  {TABLE_CONFIG.map(({ key, label, icon, description }) => (
                    <option key={key} value={key}>{icon} {label} — {description}</option>
                  ))}
                </select>
              </div>

              {/* Ancienneté */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archiver les données de plus de : <strong>{olderThanMonths} mois</strong>
                </label>
                <input
                  type="range"
                  min={1} max={24} step={1}
                  value={olderThanMonths}
                  onChange={e => setOlderThanMonths(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>1 mois</span><span>6 mois</span><span>12 mois</span><span>24 mois</span>
                </div>
              </div>

              {/* Supprimer de Supabase */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={deleteFromSource}
                  onChange={e => setDeleteFromSource(e.target.checked)}
                  className="mt-0.5 rounded accent-orange-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    Supprimer de Supabase après archivage
                  </p>
                  <p className="text-xs text-gray-400">
                    Libère de l&apos;espace dans Supabase. Les données restent dans Firebase.
                    Ne cochez que si l&apos;archivage a réussi.
                  </p>
                </div>
              </label>

              {/* Stat table sélectionnée */}
              {currentStat && currentStat.count > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-700">
                  <strong>{currentStat.count.toLocaleString()}</strong> enregistrements déjà archivés pour cette table dans Firebase.
                </div>
              )}

              <button
                onClick={handleArchive}
                disabled={running}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {running
                  ? <><Loader2 size={16} className="animate-spin" /> Archivage en cours…</>
                  : <><Archive size={16} /> Lancer l&apos;archivage</>
                }
              </button>
            </div>
          )}

          {/* ── Tab Restore ── */}
          {activeTab === "restore" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Restaure des données archivées de <strong>Firebase → Supabase</strong>.
                Utile après migration ou pour consulter d&apos;anciennes données.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table à restaurer</label>
                <select
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value as ArchivableTable)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                >
                  {TABLE_CONFIG.map(({ key, label, icon }) => {
                    const stat = stats.find(s => s.table === key)
                    return (
                      <option key={key} value={key}>
                        {icon} {label} ({stat?.count ?? 0} archivés)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre max à restaurer : <strong>{restoreMax}</strong>
                </label>
                <input
                  type="range"
                  min={50} max={2000} step={50}
                  value={restoreMax}
                  onChange={e => setRestoreMax(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <button
                onClick={handleRestore}
                disabled={running || (currentStat?.count ?? 0) === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {running
                  ? <><Loader2 size={16} className="animate-spin" /> Restauration en cours…</>
                  : <><RotateCcw size={16} /> Restaurer depuis Firebase</>
                }
              </button>

              {/* Section suppression */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-1">
                  <Trash2 size={14} /> Zone dangereuse
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Supprime définitivement les archives Firebase de cette table. Action irréversible.
                </p>
                {confirmDelete === selectedTable ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(selectedTable)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 rounded-lg"
                    >
                      Confirmer la suppression
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(selectedTable)}
                    disabled={running || (currentStat?.count ?? 0) === 0}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 text-sm font-medium py-2 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                    Supprimer les archives {TABLE_CONFIG.find(t => t.key === selectedTable)?.label}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Tab Opérations ── */}
          {activeTab === "operations" && (
            <div className="space-y-3">
              {operations.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Database size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune opération effectuée dans cette session</p>
                </div>
              )}
              {operations.map(op => {
                const isExpanded = expandedOps.has(op.id)
                const tConf = TABLE_CONFIG.find(t => t.key === op.table)
                return (
                  <div key={op.id} className={`border rounded-xl overflow-hidden ${
                    op.status === "done"  ? "border-green-200 bg-green-50" :
                    op.status === "error" ? "border-red-200 bg-red-50" :
                    "border-blue-200 bg-blue-50"
                  }`}>
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => {
                        const next = new Set(expandedOps)
                        if (isExpanded) next.delete(op.id); else next.add(op.id)
                        setExpandedOps(next)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {op.status === "running" && <Loader2 size={16} className="animate-spin text-blue-500" />}
                        {op.status === "done"    && <CheckCircle2 size={16} className="text-green-600" />}
                        {op.status === "error"   && <AlertCircle  size={16} className="text-red-600" />}
                        <span className="text-sm font-medium">
                          {op.type === "archive" ? "↑ Archivage" :
                           op.type === "restore" ? "↓ Restauration" : "🗑 Suppression"}{" "}
                          {tConf?.icon} {tConf?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {op.startedAt.toLocaleTimeString()}
                        </span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-1 border-t border-current/10">
                        {op.progress.map((msg, i) => (
                          <p key={i} className="text-xs text-gray-600 font-mono">{msg}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
