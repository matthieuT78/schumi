import Head from "next/head";
import confetti from "canvas-confetti";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Visit = {
  id: string;
  visit_date: string;
  visitor_name: string;
  done: boolean;
};

type UnavailableDay = {
  id: string;
  visit_date: string;
  visitor_name: string;
};

const PEOPLE = ["Thomas", "Caro", "Papa/Nadège"] as const;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fullDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function SchumiPlanning() {
  const [selectedPerson, setSelectedPerson] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [unavailableDays, setUnavailableDays] = useState<UnavailableDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = new Date("2026-07-28T12:00:00");
    const end = new Date("2026-08-10T12:00:00");
    const list: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      list.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return list;
  }, []);

  function celebrate(person: string) {
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.62 } });

    setTimeout(() => {
      confetti({ particleCount: 55, spread: 60, origin: { x: 0.25, y: 0.75 } });
      confetti({ particleCount: 55, spread: 60, origin: { x: 0.75, y: 0.75 } });
    }, 180);

    setCelebrationMsg(`🐱 Schumi est content ! Merci ${person} ❤️`);

    window.setTimeout(() => setCelebrationMsg(null), 2600);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(80);
    }
  }

  async function loadVisits() {
    setLoading(true);
    setLoadError(null);

    try {
      const from = formatDate(days[0]);
      const to = formatDate(days[days.length - 1]);

      const [visitsResult, unavailableResult] = await Promise.all([
        supabase
          .from("cat_daily_visits")
          .select("*")
          .gte("visit_date", from)
          .lte("visit_date", to)
          .order("visit_date", { ascending: true }),

        supabase
          .from("cat_unavailable_days")
          .select("*")
          .gte("visit_date", from)
          .lte("visit_date", to)
          .order("visit_date", { ascending: true }),
      ]);

      if (visitsResult.error || unavailableResult.error) {
        console.error(visitsResult.error || unavailableResult.error);
        setLoadError("Impossible de charger le planning.");
      } else {
        setVisits((visitsResult.data || []) as Visit[]);
        setUnavailableDays((unavailableResult.data || []) as UnavailableDay[]);
      }
    } catch (err) {
      console.error(err);
      setLoadError("Connexion impossible. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisits();
  }, []);

  function findVisit(date: string) {
    return visits.find((v) => v.visit_date === date);
  }

  async function bookDay(date: string) {
    if (!selectedPerson) {
      alert("Choisis d’abord ton nom en haut de la page 🙂");
      return;
    }

    setSavingDate(date);

    const { error } = await supabase
      .from("cat_daily_visits")
      .upsert(
        {
          visit_date: date,
          visitor_name: selectedPerson,
          done: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visit_date" }
      )
      .select();

    if (error) {
      alert("Erreur lors de l’enregistrement.");
      console.error(error);
    } else {
      celebrate(selectedPerson);
      await loadVisits();
    }

    setSavingDate(null);
  }

  async function markUnavailable(date: string) {
    if (!selectedPerson) {
      alert("Choisis d’abord ton nom en haut de la page 🙂");
      return;
    }

    setSavingDate(date);

    const { error } = await supabase
      .from("cat_unavailable_days")
      .upsert(
        {
          visit_date: date,
          visitor_name: selectedPerson,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visit_date,visitor_name" }
      )
      .select();

    if (error) {
      alert("Erreur lors de l’enregistrement.");
      console.error(error);
    } else {
      await loadVisits();
    }

    setSavingDate(null);
  }

  async function removeUnavailable(unavailable: UnavailableDay) {
    const { error } = await supabase.from("cat_unavailable_days").delete().eq("id", unavailable.id);

    if (error) {
      alert("Erreur lors de la suppression.");
      console.error(error);
    } else {
      await loadVisits();
    }
  }

  async function toggleDone(visit: Visit) {
    const { error } = await supabase
      .from("cat_daily_visits")
      .update({
        done: !visit.done,
        updated_at: new Date().toISOString(),
      })
      .eq("id", visit.id);

    if (error) {
      alert("Erreur lors de la mise à jour.");
      console.error(error);
    } else {
      if (!visit.done) celebrate(visit.visitor_name);
      await loadVisits();
    }
  }

  async function clearDay(visit: Visit) {
    const ok = confirm("Tu veux libérer cette journée ?");
    if (!ok) return;

    const { error } = await supabase.from("cat_daily_visits").delete().eq("id", visit.id);

    if (error) {
      alert("Erreur lors de la suppression.");
      console.error(error);
    } else {
      await loadVisits();
    }
  }

  const bookedDays = visits.length;
  const doneDays = visits.filter((v) => v.done).length;
  const unavailableCount = unavailableDays.length;

  return (
    <>
      <Head>
        <title>Planning Schumi 🐱</title>
        <meta name="description" content="Planning pour nourrir Schumi pendant les vacances." />
      </Head>

      <main className="min-h-screen bg-[#FFF8EE] px-4 py-5 text-slate-900">
        <div className="mx-auto max-w-lg space-y-5">
          <section className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-orange-100 text-4xl">
                🐱
              </div>

              <div>
                <p className="text-sm font-bold text-orange-500">Planning vacances</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                  Nourrir Schumi
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Choisis ton nom, prends une journée, ou indique simplement si tu n’es pas disponible.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-orange-50 p-4">
              <p className="text-sm font-bold text-slate-900">Période à couvrir</p>
              <p className="mt-1 text-sm text-slate-600">
                Du <strong>mardi 28 juillet</strong> au <strong>lundi 10 août</strong>.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Pris" value={`${bookedDays}`} />
              <Stat label="Faits" value={`${doneDays}`} />
              <Stat label="Indispos" value={`${unavailableCount}`} />
            </div>
          </section>

          <section className="sticky top-0 z-20 rounded-[24px] border border-orange-100 bg-white/95 p-4 shadow-sm backdrop-blur">
            <p className="text-sm font-black text-slate-950">1. Qui es-tu ?</p>
            <p className="mt-1 text-xs text-slate-500">
              Sélectionne ton nom avant d’agir sur une journée.
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {PEOPLE.map((person) => (
                <button
                  key={person}
                  type="button"
                  onClick={() => setSelectedPerson(person)}
                  className={`rounded-2xl px-3 py-3 text-sm font-black transition active:scale-[0.98] ${
                    selectedPerson === person
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-orange-50 text-slate-700"
                  }`}
                >
                  {person}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">2. Organise le planning</p>
            <p className="mt-1 text-xs text-slate-500">
              “Je ne suis pas là” ajoute seulement une note visible par les autres. Cela ne bloque pas la journée.
            </p>
          </section>

          {loading ? (
            <div className="rounded-[24px] bg-white p-5 text-sm text-slate-500 shadow-sm">
              Chargement du planning…
            </div>
          ) : loadError ? (
            <div className="rounded-[24px] border border-red-100 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
              <p className="font-black">{loadError}</p>
              <button
                type="button"
                onClick={loadVisits}
                className="mt-3 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm active:scale-[0.98]"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <section className="space-y-3">
              {days.map((day) => {
                const date = formatDate(day);
                const visit = findVisit(date);
                const unavailableForDay = unavailableDays.filter((u) => u.visit_date === date);

                const previousDay = new Date(day);
                previousDay.setDate(previousDay.getDate() - 1);
                const previousVisit = findVisit(formatDate(previousDay));

                const optionalBecauseYesterday = !visit && !!previousVisit;

                return (
                  <DayCard
                    key={date}
                    date={date}
                    title={fullDate(day)}
                    visit={visit}
                    unavailableForDay={unavailableForDay}
                    saving={savingDate === date}
                    optionalBecauseYesterday={optionalBecauseYesterday}
                    previousVisitor={previousVisit?.visitor_name}
                    onBook={bookDay}
                    onUnavailable={markUnavailable}
                    onRemoveUnavailable={removeUnavailable}
                    onDone={toggleDone}
                    onClear={clearDay}
                  />
                );
              })}
            </section>
          )}

          <button
            type="button"
            onClick={loadVisits}
            className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm active:scale-[0.98]"
          >
            🔄 Actualiser le planning
          </button>
        </div>

        {celebrationMsg && (
          <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2">
            <div className="animate-bounce rounded-3xl bg-slate-950 px-5 py-4 text-center text-sm font-black text-white shadow-2xl">
              {celebrationMsg}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-3 text-center shadow-sm">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function UnavailableNotes({
  items,
  onRemove,
}: {
  items: UnavailableDay[];
  onRemove: (item: UnavailableDay) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3">
      <p className="text-sm font-black text-red-700">Indisponibilités signalées</p>

      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
            <p className="text-sm text-red-700">
              <span className="font-black">{item.visitor_name}</span> n’est pas dispo à ce créneau.
            </p>

            <button
              type="button"
              onClick={() => onRemove(item)}
              className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-600"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCard({
  date,
  title,
  visit,
  unavailableForDay,
  saving,
  optionalBecauseYesterday,
  previousVisitor,
  onBook,
  onUnavailable,
  onRemoveUnavailable,
  onDone,
  onClear,
}: {
  date: string;
  title: string;
  visit?: Visit;
  unavailableForDay: UnavailableDay[];
  saving: boolean;
  optionalBecauseYesterday?: boolean;
  previousVisitor?: string;
  onBook: (date: string) => void;
  onUnavailable: (date: string) => void;
  onRemoveUnavailable: (item: UnavailableDay) => void;
  onDone: (visit: Visit) => void;
  onClear: (visit: Visit) => void;
}) {
  if (!visit) {
    return (
      <article
        className={`rounded-[26px] border p-4 shadow-sm transition ${
          optionalBecauseYesterday ? "border-slate-200 bg-slate-50" : "border-orange-100 bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
              optionalBecauseYesterday ? "bg-slate-100" : "bg-orange-50"
            }`}
          >
            {optionalBecauseYesterday ? "😴" : "📝"}
          </div>

          <div className="flex-1">
            <h2 className="text-base font-black capitalize text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {optionalBecauseYesterday
                ? `${previousVisitor || "Quelqu’un"} est passé(e) hier.`
                : "Personne pour l’instant"}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              optionalBecauseYesterday ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-500"
            }`}
          >
            {optionalBecauseYesterday ? "Optionnel" : "Libre"}
          </span>
        </div>

        {optionalBecauseYesterday && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm leading-relaxed text-slate-600">
              Quelqu’un est déjà passé hier. Ce n’est donc pas obligatoire de venir aujourd’hui :
              ça peut attendre demain. Mais tu peux quand même prendre la journée.
            </p>
          </div>
        )}

        <UnavailableNotes items={unavailableForDay} onRemove={onRemoveUnavailable} />

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => onBook(date)}
            disabled={saving}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${
              optionalBecauseYesterday ? "bg-slate-700" : "bg-orange-500"
            }`}
          >
            {saving ? "Enregistrement…" : optionalBecauseYesterday ? "Je passe quand même" : "Je prends cette journée"}
          </button>

          <button
            type="button"
            onClick={() => onUnavailable(date)}
            disabled={saving}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            Je ne suis pas là cette journée
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`relative overflow-hidden rounded-[26px] border-2 p-4 shadow-sm ${
        visit.done ? "border-emerald-400 bg-emerald-100" : "border-emerald-300 bg-emerald-50"
      }`}
    >
      <div className="absolute right-4 top-4 text-4xl opacity-20">
        {visit.done ? "✅" : "🐾"}
      </div>

      <div className="mb-4 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
        {visit.done ? "Passage effectué" : "Journée réservée"}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
          {visit.done ? "✅" : "🐾"}
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-black capitalize text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-emerald-800">
            {visit.done ? "Fait par " : "Réservé par "}
            <span className="font-black text-emerald-950">{visit.visitor_name}</span>
          </p>
        </div>
      </div>

      <UnavailableNotes items={unavailableForDay} onRemove={onRemoveUnavailable} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onDone(visit)}
          className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-slate-800 shadow-sm active:scale-[0.98]"
        >
          {visit.done ? "Pas fait" : "Fait"}
        </button>

        <button
          type="button"
          onClick={() => onBook(date)}
          className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-slate-800 shadow-sm active:scale-[0.98]"
        >
          Changer
        </button>

        <button
          type="button"
          onClick={() => onClear(visit)}
          className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-red-500 shadow-sm active:scale-[0.98]"
        >
          Libérer
        </button>
      </div>

      <button
        type="button"
        onClick={() => onUnavailable(date)}
        disabled={saving}
        className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-black text-slate-600 shadow-sm active:scale-[0.98] disabled:opacity-60"
      >
        Signaler que je ne suis pas dispo ce jour
      </button>
    </article>
  );
}
