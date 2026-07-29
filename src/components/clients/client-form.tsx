import Link from "next/link";
import { ACTIVITY_TYPE_OPTIONS, CLIENT_STATUS_OPTIONS, type ClientStatus } from "@/lib/crm/constants";

type SellerOption = {
  id: string;
  full_name: string | null;
};

type InterestOption = {
  id: string;
  name: string;
  active: boolean;
};

type ClientFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  locality: string;
  address: string;
  status: ClientStatus;
  assignedUserId: string;
  notes: string;
  interestIds: string[];
};

type ClientFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  cancelHref: string;
  action: (formData: FormData) => void;
  sellers: SellerOption[];
  interests: InterestOption[];
  values: ClientFormValues;
  isAdmin: boolean;
  errorMessage?: string;
  /** Muestra la seccion opcional de primer seguimiento (solo en el alta). */
  withFirstFollowUp?: boolean;
};

const inputClasses =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

const labelClasses = "mb-1.5 block text-label-md font-semibold";

export function ClientForm({
  title,
  subtitle,
  submitLabel,
  cancelHref,
  action,
  sellers,
  interests,
  values,
  isAdmin,
  errorMessage,
  withFirstFollowUp = false,
}: ClientFormProps) {
  const activeInterests = interests.filter((interest) => interest.active);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={cancelHref}
        className="mb-4 inline-flex items-center gap-1 text-label-md font-semibold text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Volver
      </Link>

      <section className="mb-6">
        <h1 className="text-headline-md font-bold lg:text-headline-lg">{title}</h1>
        <p className="text-body-lg text-on-surface-variant">{subtitle}</p>
      </section>

      {errorMessage ? (
        <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
          {errorMessage}
        </p>
      ) : null}

      <form action={action} className="space-y-6">
        <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm lg:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-headline-sm font-bold">
            <span className="material-symbols-outlined text-primary">person</span>
            Datos del cliente
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Nombre *</span>
              <input name="firstName" defaultValue={values.firstName} required className={inputClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Apellido</span>
              <input name="lastName" defaultValue={values.lastName} className={inputClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Telefono *</span>
              <input
                name="phone"
                type="tel"
                defaultValue={values.phone}
                required
                placeholder="Ej: 11 2345 6789"
                className={inputClasses}
              />
            </label>
            <label className="block">
              <span className={labelClasses}>Localidad</span>
              <input name="locality" defaultValue={values.locality} className={inputClasses} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClasses}>Direccion</span>
              <input name="address" defaultValue={values.address} className={inputClasses} />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm lg:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-headline-sm font-bold">
            <span className="material-symbols-outlined text-primary">storefront</span>
            Situacion comercial
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Estado</span>
              <select name="status" defaultValue={values.status} className={inputClasses}>
                {CLIENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClasses}>Vendedor asignado *</span>
              <select
                name="assignedUserId"
                defaultValue={values.assignedUserId}
                disabled={!isAdmin}
                className={`${inputClasses} disabled:bg-surface-container-low disabled:text-on-surface-variant`}
              >
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.full_name ?? seller.id}
                  </option>
                ))}
              </select>
            </label>
            {!isAdmin ? <input type="hidden" name="assignedUserId" value={values.assignedUserId} /> : null}
          </div>

          <div className="mt-5">
            <span className={labelClasses}>Que le interesa?</span>
            {activeInterests.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Todavia no hay intereses cargados en el catalogo.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeInterests.map((interest) => (
                  <label
                    key={interest.id}
                    className="cursor-pointer rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-md font-semibold text-on-surface-variant transition-colors select-none has-checked:border-primary has-checked:bg-primary-fixed has-checked:text-primary"
                  >
                    <input
                      type="checkbox"
                      name="interestIds"
                      value={interest.id}
                      defaultChecked={values.interestIds.includes(interest.id)}
                      className="sr-only"
                    />
                    {interest.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="mt-5 block">
            <span className={labelClasses}>Observaciones</span>
            <textarea
              name="notes"
              defaultValue={values.notes}
              rows={3}
              placeholder="Lo que haga falta recordar de este cliente..."
              className={`${inputClasses} resize-y`}
            />
          </label>
        </section>

        {withFirstFollowUp ? (
          <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-sm lg:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-headline-sm font-bold">
              <span className="material-symbols-outlined text-primary">event_available</span>
              Primer seguimiento (opcional)
            </h2>
            <p className="mb-4 text-body-md text-on-surface-variant">
              Si dejas una fecha, el cliente queda agendado y no se pierde. Recomendado.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClasses}>Como lo vas a contactar?</span>
                <select name="firstFollowUpType" defaultValue="whatsapp" className={inputClasses}>
                  {ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses}>Cuando?</span>
                <input type="datetime-local" name="firstFollowUpAt" className={inputClasses} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClasses}>Objetivo</span>
                <input
                  name="firstFollowUpObjective"
                  placeholder="Ej: pasarle precio y foto del sillon que miro"
                  className={inputClasses}
                />
              </label>
            </div>
          </section>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
          >
            <span className="material-symbols-outlined text-base">check</span>
            {submitLabel}
          </button>
          <Link
            href={cancelHref}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest px-6 py-3 text-label-md font-semibold transition-colors hover:bg-surface-container"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
