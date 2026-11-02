'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowDownToLine, Check, ChevronDown, LoaderCircle, Plus, RefreshCw, Shirt, Trash2, Upload, WandSparkles } from 'lucide-react';
import { compressImage } from '@/lib/client-image';
import {
  JERSEY_COLLARS,
  JERSEY_COLLAR_LABELS,
  JERSEY_LOGO_PLACEMENTS,
  JERSEY_PATTERNS,
  JERSEY_PATTERN_LABELS,
  JERSEY_PLACEMENT_LABELS,
  JERSEY_SIZES,
  JERSEY_SLEEVES,
  JERSEY_SLEEVE_LABELS,
  MAX_JERSEY_LOGO_BYTES,
  MAX_JERSEY_LOGOS,
  type JerseyFields,
  type JerseyLogoPlacementValue,
} from '@/lib/jersey-config';
import { jerseyPreviewSvg, jerseySvgDataUrl, type JerseyPreviewSponsor } from '@/lib/jersey-svg';

type SponsorDraft = JerseyPreviewSponsor & { id: string; file: File };

const INITIAL_FIELDS: JerseyFields = {
  customerName: '',
  phone: '',
  playerName: '',
  jerseyNumber: 10,
  teamName: '',
  size: 'M',
  primaryColor: '#9B0000',
  secondaryColor: '#F4C542',
  pattern: 'DIAGONAL',
  collar: 'CREW',
  sleeve: 'SHORT',
};

function fileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this logo.'));
    reader.onerror = () => reject(new Error('Could not read this logo.'));
    reader.readAsDataURL(file);
  });
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mangwaoo-jersey';
}

export default function JerseyDesigner() {
  const [fields, setFields] = useState<JerseyFields>(INITIAL_FIELDS);
  const [sponsors, setSponsors] = useState<SponsorDraft[]>([]);
  const [draftId, setDraftId] = useState('');
  const [fabric, setFabric] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const frontPreview = useMemo(
    () => fabric ? jerseySvgDataUrl(jerseyPreviewSvg(fields, fabric, sponsors, 'front')) : '',
    [fields, fabric, sponsors]
  );
  const backPreview = useMemo(
    () => fabric ? jerseySvgDataUrl(jerseyPreviewSvg(fields, fabric, sponsors, 'back')) : '',
    [fields, fabric, sponsors]
  );

  const setField = <K extends keyof JerseyFields>(key: K, value: JerseyFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    setSuccess('');
  };

  async function addSponsor(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG or WebP logo. SVG files are not accepted.');
      return;
    }
    if (file.size > 5_000_000) {
      setError('Choose a logo under 5 MB before compression.');
      return;
    }
    if (sponsors.length >= MAX_JERSEY_LOGOS) {
      setError(`You can add up to ${MAX_JERSEY_LOGOS} sponsor logos.`);
      return;
    }

    try {
      let compressed = await compressImage(file, { maxDimension: 1100, quality: 0.76 });
      if (compressed.size > MAX_JERSEY_LOGO_BYTES) compressed = await compressImage(file, { maxDimension: 800, quality: 0.55 });
      if (compressed.size > MAX_JERSEY_LOGO_BYTES) {
        setError('This logo is still too large after compression. Try a smaller image.');
        return;
      }
      const upload = new File([compressed], `${slug(file.name.replace(/\.[^.]+$/, ''))}.jpg`, { type: 'image/jpeg' });
      const imageDataUrl = await fileAsDataUrl(upload);
      setSponsors((current) => [...current, {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 48),
        placement: 'FRONT_CHEST',
        imageDataUrl,
        file: upload,
      }]);
      setSuccess('Logo added. Choose where it should appear on the jersey.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not prepare this logo.');
    }
  }

  function updateSponsor(id: string, change: Partial<Pick<SponsorDraft, 'name' | 'placement'>>) {
    setSponsors((current) => current.map((sponsor) => sponsor.id === id ? { ...sponsor, ...change } : sponsor));
  }

  async function generateDesign() {
    setError('');
    setSuccess('');
    if (!fields.customerName.trim() || !fields.phone.trim() || !fields.playerName.trim() || !fields.teamName.trim()) {
      setError('Fill in your contact details, player name and team name before generating.');
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch('/api/jerseys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, ...(draftId ? { draftId } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not generate the design.');
      setDraftId(data.designId);
      setFabric(data.baseImage);
      setSuccess('Your AI fabric design is ready. Your exact name, number and logos are placed separately on top.');
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not generate the design.');
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPreview(side: 'front' | 'back') {
    const svg = jerseyPreviewSvg(fields, fabric, sponsors, side);
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      const imageReady = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not prepare the jersey download.'));
      });
      image.src = objectUrl;
      await imageReady;
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 1120;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the jersey download.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the PNG.')), 'image/png'));
      const downloadUrl = URL.createObjectURL(png);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${slug(fields.teamName)}-${slug(fields.playerName)}-${side}.png`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download this preview.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function submitDesign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!draftId || !fabric) {
      setError('Generate your AI jersey preview before sending the enquiry.');
      return;
    }

    const combinedLogoSize = sponsors.reduce((total, sponsor) => total + sponsor.file.size, 0);
    if (combinedLogoSize > 1_500_000) {
      setError('Keep your combined sponsor logo upload under 1.5 MB.');
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append('designId', draftId);
      for (const [key, value] of Object.entries(fields)) body.append(key, String(value));
      body.append('sponsors', JSON.stringify(sponsors.map(({ name, placement }) => ({ name, placement }))));
      sponsors.forEach((sponsor, index) => body.append(`logo_${index}`, sponsor.file, sponsor.file.name));
      const response = await fetch('/api/jerseys/submit', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your enquiry.');
      setSuccess(`Enquiry received. Your reference is MWJ-${data.reference}. Our team will contact you on ${fields.phone}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save your enquiry.');
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-surface px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/15';
  const labelClass = 'block text-sm font-semibold text-ink';
  const selectClass = `${fieldClass} appearance-none pr-9`;

  return (
    <form onSubmit={submitDesign} className="w-full">
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-surface p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent"><span className="text-sm font-black">01</span></span>
              <div><h2 className="text-lg font-bold text-ink">Who’s the jersey for?</h2><p className="mt-1 text-sm text-brand-gray">Our team uses these details to follow up on your design.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Your name<input className={fieldClass} required maxLength={80} autoComplete="name" value={fields.customerName} onChange={(event) => setField('customerName', event.target.value)} placeholder="Full name" /></label>
              <label className={labelClass}>Phone number<input className={fieldClass} required maxLength={30} type="tel" autoComplete="tel" value={fields.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="03XX XXXXXXX" /></label>
              <label className={labelClass}>Player name<input className={fieldClass} required maxLength={32} value={fields.playerName} onChange={(event) => setField('playerName', event.target.value)} placeholder="Name on the back" /></label>
              <label className={labelClass}>Jersey number<input className={fieldClass} required type="number" min={0} max={99} value={fields.jerseyNumber} onChange={(event) => setField('jerseyNumber', Number(event.target.value))} /></label>
              <label className={labelClass}>Team name<input className={fieldClass} required maxLength={48} value={fields.teamName} onChange={(event) => setField('teamName', event.target.value)} placeholder="Team or club" /></label>
              <label className={labelClass}>Size<span className="relative block"><select className={selectClass} value={fields.size} onChange={(event) => setField('size', event.target.value as JerseyFields['size'])}>{JERSEY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-brand-gray" /></span></label>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-surface p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent"><span className="text-sm font-black">02</span></span>
              <div><h2 className="text-lg font-bold text-ink">Make it yours</h2><p className="mt-1 text-sm text-brand-gray">Pick colours and a pattern. Gemini creates a fresh fabric design from your choices.</p></div>
            </div>
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <label className={labelClass}>Primary colour<span className="mt-1.5 flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2"><input aria-label="Primary jersey colour" type="color" className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent p-0" value={fields.primaryColor} onChange={(event) => setField('primaryColor', event.target.value.toUpperCase())} /><span className="text-sm font-medium text-brand-gray">{fields.primaryColor}</span></span></label>
              <label className={labelClass}>Secondary colour<span className="mt-1.5 flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2"><input aria-label="Secondary jersey colour" type="color" className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent p-0" value={fields.secondaryColor} onChange={(event) => setField('secondaryColor', event.target.value.toUpperCase())} /><span className="text-sm font-medium text-brand-gray">{fields.secondaryColor}</span></span></label>
              <label className={labelClass}>Pattern<span className="relative block"><select className={selectClass} value={fields.pattern} onChange={(event) => setField('pattern', event.target.value as JerseyFields['pattern'])}>{JERSEY_PATTERNS.map((pattern) => <option key={pattern} value={pattern}>{JERSEY_PATTERN_LABELS[pattern]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-brand-gray" /></span></label>
              <label className={labelClass}>Collar<span className="relative block"><select className={selectClass} value={fields.collar} onChange={(event) => setField('collar', event.target.value as JerseyFields['collar'])}>{JERSEY_COLLARS.map((collar) => <option key={collar} value={collar}>{JERSEY_COLLAR_LABELS[collar]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-brand-gray" /></span></label>
              <label className={labelClass}>Sleeves<span className="relative block"><select className={selectClass} value={fields.sleeve} onChange={(event) => setField('sleeve', event.target.value as JerseyFields['sleeve'])}>{JERSEY_SLEEVES.map((sleeve) => <option key={sleeve} value={sleeve}>{JERSEY_SLEEVE_LABELS[sleeve]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-brand-gray" /></span></label>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-surface p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent"><span className="text-sm font-black">03</span></span><div><h2 className="text-lg font-bold text-ink">Sponsor logos</h2><p className="mt-1 text-sm text-brand-gray">Add up to {MAX_JERSEY_LOGOS} logos and choose their placement.</p></div></div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-ink transition hover:border-accent hover:text-accent sm:text-sm"><Plus className="h-4 w-4" /> Add logo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={addSponsor} disabled={sponsors.length >= MAX_JERSEY_LOGOS} /></label>
            </div>
            {sponsors.length ? <div className="space-y-3">{sponsors.map((sponsor, index) => (
              <div key={sponsor.id} className="grid gap-3 rounded-2xl border border-gray-100 bg-brand-light/40 p-3 sm:grid-cols-[64px_minmax(0,1fr)_minmax(150px,.8fr)_36px] sm:items-center">
                {/* The image was decoded, downscaled and re-encoded in the browser before it can enter the form state. */}
                <img src={sponsor.imageDataUrl} alt={`${sponsor.name || `Sponsor ${index + 1}`} logo preview`} className="h-14 w-16 rounded-lg bg-white object-contain p-1" />
                <label className="text-xs font-semibold text-brand-gray">Sponsor name<input className={`${fieldClass} mt-1 py-2.5`} maxLength={48} value={sponsor.name} onChange={(event) => updateSponsor(sponsor.id, { name: event.target.value })} placeholder={`Sponsor ${index + 1}`} /></label>
                <label className="text-xs font-semibold text-brand-gray">Placement<span className="relative block"><select className={`${selectClass} mt-1 py-2.5`} value={sponsor.placement} onChange={(event) => updateSponsor(sponsor.id, { placement: event.target.value as JerseyLogoPlacementValue })}>{JERSEY_LOGO_PLACEMENTS.map((placement) => <option key={placement} value={placement}>{JERSEY_PLACEMENT_LABELS[placement]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-brand-gray" /></span></label>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-gray hover:bg-red-50 hover:text-danger" aria-label={`Remove sponsor ${index + 1}`} onClick={() => setSponsors((current) => current.filter((item) => item.id !== sponsor.id))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}</div> : <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-7 text-center"><Upload className="mx-auto h-6 w-6 text-brand-gray" /><p className="mt-2 text-sm font-semibold text-ink">No sponsor logos added</p><p className="mt-1 text-xs text-brand-gray">JPG, PNG or WebP. Each logo is compressed to 500 KB or less.</p></div>}
          </section>

          {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p> : null}
          {success ? <p role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><Check className="mt-0.5 h-4 w-4 shrink-0" />{success}</p> : null}

          <button type="button" onClick={generateDesign} disabled={generating || saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-red-primary px-5 py-4 text-base font-bold text-white shadow-lg shadow-brand-red-primary/15 transition hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-60">
            {generating ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Creating your AI fabric…</> : fabric ? <><RefreshCw className="h-5 w-5" /> Regenerate design</> : <><WandSparkles className="h-5 w-5" /> Generate my jersey</>}
          </button>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <section className="overflow-hidden rounded-3xl border border-gray-100 bg-surface shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Live mockup</p><h2 className="mt-1 text-lg font-bold text-ink">Front & back</h2></div>
              <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-gray">Size {fields.size}</span>
            </div>
            {fabric ? <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
              {([{ side: 'front', source: frontPreview }, { side: 'back', source: backPreview }] as const).map(({ side, source }) => (
                <div key={side} className="overflow-hidden rounded-2xl bg-[#f5f5f3] p-2 sm:p-3">
                  <div className="mb-1 flex items-center justify-between px-1"><span className="text-xs font-bold uppercase tracking-widest text-gray-500">{side}</span><button type="button" onClick={() => void downloadPreview(side)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-accent hover:bg-white" aria-label={`Download ${side} preview`}><ArrowDownToLine className="h-3.5 w-3.5" /> PNG</button></div>
                  <img src={source} alt={`${side} preview for ${fields.teamName} jersey`} className="mx-auto aspect-[6/7] w-full max-w-[300px] object-contain" />
                </div>
              ))}
            </div> : <div className="flex min-h-[420px] flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#fff1ed,transparent_60%)] px-8 text-center sm:min-h-[540px]"><div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm"><Shirt className="h-10 w-10 text-accent" /></div><h3 className="mt-5 text-lg font-bold text-ink">Your design starts here</h3><p className="mt-2 max-w-xs text-sm leading-6 text-brand-gray">Choose a style and generate the AI fabric. The name, number and sponsor placements stay crisp and exact.</p></div>}
          </section>
          <section className="rounded-3xl bg-brand-dark p-5 text-white sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-white/60">Ready to order?</p>
            <h2 className="mt-2 text-xl font-bold">Send your design to Mangwaoo</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">We’ll review the mockup and contact you to confirm fabric, pricing and delivery.</p>
            <button type="submit" disabled={!fabric || !draftId || saving || generating} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-brand-red-primary transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending enquiry…</> : success.startsWith('Enquiry received') ? <><Check className="h-4 w-4" /> Enquiry sent</> : 'Submit jersey enquiry'}
            </button>
            <p className="mt-3 text-center text-xs text-white/55">No payment is collected on this form.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}

