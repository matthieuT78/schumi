import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type VisitStatus = "booked" | "unavailable";

type Visit = {
  id: string;
  visit_date: string;
  visitor_name: string;
  done: boolean;
  unavailable: boolean;
};

const PEOPLE = ["Thomas", "Caro", "JC/Nadège"] as const;

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
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = new Date("2026-04-29T12:00:00");
    const end = new Date("2026-05-07T12:00:00");
    const list: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      list.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return list;
  }, []);

  async function loadVisits() {
    setLoading(true);

    const { data, error } = await supabase
      .from("cat_daily_visits")
      .select("*")
      .gte("visit_date", formatDate(days[0]))
      .lte("visit_date", formatDate(days[days.length - 1]))
      .order("visit_date", { ascending: true });

    if (error) {
      alert("Impossible de charger le planning.");
      console.error(error);
    } else {
      setVisits((data || []) as Visit[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadVisits();
  }, []);

  function findVisit(date: string) {
    return visits.find((v) => v.visit_date === date);
  }

  async function saveDay(date: string, status: VisitStatus) {
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
          unavailable: status === "unavailable",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visit_date" }
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

  async function toggleDone(visit: Visit) {
    if (visit.unavailable) return;

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

  const bookedDays = visits.filter((v) => !v.unavailable).length;
  const doneDays = visits.filter((v) => v.done && !v.unavailable).length;
  const unavailableDays = visits.filter((v) => v.unavailable).length;

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
                  Choisis ton nom, puis indique si tu peux passer ou si tu n’es pas là.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-orange-50 p-4">
              <p className="text-sm font-bold text-slate-900">Période à couvrir</p>
              <p className="mt-1 text-sm text-slate-600">
                Du <strong>mercredi 29 avril</strong> au <strong>jeudi 7 mai</strong>.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Pris" value={`${bookedDays}`} />
              <Stat label="Faits" value={`${doneDays}`} />
              <Stat label="Absents" value={`${unavailableDays}`} />
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
              Tu peux prendre une journée, ou prévenir que tu n’es pas disponible. Si quelqu’un est passé la veille,
              la journée suivante est optionnelle.
            </p>
          </section>

          {loading ? (
            <div className="rounded-[24px] bg-white p-5 text-sm text-slate-500 shadow-sm">
              Chargement du planning…
            </div>
          ) : (
            <section className="space-y-3">
              {days.map((day) => {
                const date = formatDate(day);
                const visit = findVisit(date);

                const previousDay = new Date(day);
                previousDay.setDate(previousDay.getDate() - 1);
                const previousVisit = findVisit(formatDate(previousDay));

                const optionalBecauseYesterday = !visit && !!previousVisit && !previousVisit.unavailable;

                return (
                  <DayCard
                    key={date}
                    date={date}
                    title={fullDate(day)}
                    visit={visit}
                    saving={savingDate === date}
                    optionalBecauseYesterday={optionalBecauseYesterday}
                    previousVisitor={previousVisit?.visitor_name}
                    onBook={(d) => saveDay(d, "booked")}
                    onUnavailable={(d) => saveDay(d, "unavailable")}
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

function DayCard({
  date,
  title,
  visit,
  saving,
  optionalBecauseYesterday,
  previousVisitor,
  onBook,
  onUnavailable,
  onDone,
  onClear,
}: {
  date: string;
  title: string;
  visit?: Visit;
  saving: boolean;
  optionalBecauseYesterday?: boolean;
  previousVisitor?: string;
  onBook: (date: string) => void;
  onUnavailable: (date: string) => void;
  onDone: (visit: Visit) => void;
  onClear: (visit: Visit) => void;
}) {
  if (!visit) {
    return (
      <article
        className={`rounded-[26px] border p-4 shadow-sm transition ${
          optionalBecauseYesterday
            ? "border-slate-200 bg-slate-50"
            : "border-orange-100 bg-white"
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
              optionalBecauseYesterday
                ? "bg-slate-200 text-slate-600"
                : "bg-slate-100 text-slate-500"
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

  if (visit.unavailable) {
    return (
      <article className="rounded-[26px] border border-red-100 bg-red-50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-2xl">
            🚫
          </div>

          <div className="flex-1">
            <h2 className="text-base font-black capitalize text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-red-700">
              <span className="font-black">{visit.visitor_name}</span> n’est pas disponible ce jour-là.
            </p>
          </div>

          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
            Absent
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onBook(date)}
            className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-slate-800 shadow-sm active:scale-[0.98]"
          >
            Je peux finalement
          </button>

          <button
            type="button"
            onClick={() => onClear(visit)}
            className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-red-500 shadow-sm active:scale-[0.98]"
          >
            Effacer
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`rounded-[26px] border p-4 shadow-sm ${
        visit.done ? "border-emerald-200 bg-emerald-50" : "border-orange-100 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
            visit.done ? "bg-emerald-100" : "bg-orange-50"
          }`}
        >
          {visit.done ? "✅" : "🐾"}
        </div>

        <div className="flex-1">
          <h2 className="text-base font-black capitalize text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {visit.done ? "Fait par " : "Prévu avec "}
            <span className="font-black text-slate-950">{visit.visitor_name}</span>
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            visit.done ? "bg-emerald-200 text-emerald-800" : "bg-orange-100 text-orange-700"
          }`}
        >
          {visit.done ? "Fait" : "Prévu"}
        </span>
      </div>

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
    </article>
  );
}
