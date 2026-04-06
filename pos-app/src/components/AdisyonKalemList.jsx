import { formatTry } from "../lib/format.js";

/**
 * Dokunmatik: satıra basınca seçim, boş alana basınca temizleme.
 * Toplam satırı üst bileşende tutulur (kaydırma dışında).
 */
export default function AdisyonKalemList({
  kalemler = [],
  seciliKalemIds = [],
  onToggleKalem,
  onClearSelection,
  className = "",
  minHeight = "min-h-[200px]",
  maxHeightClass = "max-h-[calc(100vh-320px)]",
  emptyLabel = "Henüz satır yok.",
}) {
  return (
    <div
      className={`flex flex-col ${minHeight} ${maxHeightClass} overflow-y-auto rounded-lg border border-pos-border bg-pos-bg/50 flex flex-col ${className}`}
      onClick={onClearSelection}
      role="presentation"
    >
      {(kalemler ?? []).length === 0 ? (
        <p className="p-4 text-slate-500 text-sm">{emptyLabel}</p>
      ) : (
        <>
          <ul className="divide-y divide-pos-border shrink-0">
            {kalemler.map((k) => {
              const sec = seciliKalemIds.includes(k.id);
              return (
                <li key={k.id} className="list-none">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleKalem(k.id);
                    }}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-4 min-h-[64px] text-left transition-colors active:scale-[0.99]",
                      sec
                        ? "bg-emerald-500/20 border-l-4 border-emerald-400/90"
                        : "border-l-4 border-transparent hover:bg-slate-800/50",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-100 text-base">
                        <span className="font-mono text-slate-500">{k.adet}×</span> {k.urun_adi}
                      </span>
                      {k.ikram && (
                        <span className="ml-2 text-[10px] uppercase text-amber-400">ikram</span>
                      )}
                      {k.iade && (
                        <span className="ml-2 text-[10px] uppercase text-rose-400">iade</span>
                      )}
                    </div>
                    <span className="font-mono text-slate-200 text-base shrink-0 tabular-nums">
                      {formatTry(k.toplam_fiyat)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex-1 min-h-[120px] min-w-full shrink-0" aria-hidden />
        </>
      )}
    </div>
  );
}
