import React, { useMemo, useState } from 'react';
import {
  Edit3,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Customer } from '../types';
import {
  computeCustomerStats,
  formatCurrency,
  formatShortDate,
} from '../utils/businessLogic';
import { statusTextClass } from './DashboardView';
import { ConfirmDialog } from './ConfirmDialog';

export function CustomersView() {
  const {
    customers,
    orders,
    business,
    selectedCustomerId,
    setSelectedCustomerId,
    saveCustomer,
    deleteCustomer,
    openMessageModal,
    setActiveSection,
    setSelectedOrderId,
  } = useApp();

  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openCustomerForm = (cust: Customer | null = null) => {
    setEditingCustomer(cust);
    setName(cust?.name || '');
    setEmail(cust?.email || '');
    setPhone(cust?.phone || '');
    setInstagram(cust?.instagram || '');
    setFacebook(cust?.facebook || '');
    setAddress(cust?.address || '');
    setNotes(cust?.notes || '');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const saved = await saveCustomer({
        id: editingCustomer?.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        address: address.trim(),
        notes: notes.trim(),
        lastInteractionAt: editingCustomer?.lastInteractionAt,
      });
      setFormOpen(false);
      setSelectedCustomerId(saved.id);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.name} ${c.email} ${c.phone} ${c.instagram} ${c.facebook} ${c.notes}`
        .toLowerCase()
        .includes(q)
    );
  }, [customers, query]);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const activeStats = useMemo(
    () => (activeCustomer ? computeCustomerStats(activeCustomer.id, orders) : null),
    [activeCustomer, orders]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
            Customers
          </h2>
          <p className="mt-0.5 text-sm text-stone-600 dark:text-zinc-400">
            Contact details, social handles, balances, and complete order history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCustomerForm(null)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 sm:self-center dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <label htmlFor="customers-search" className="sr-only">
          Search customers
        </label>
        <input
          id="customers-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, @instagram, phone, email, or notes…"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pr-4 pl-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Customers Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Users className="mx-auto h-8 w-8 text-stone-400 dark:text-zinc-500" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-100">
              No customers found
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
              Customers are created automatically when you add an order, or you can add one manually.
            </p>
            <button
              type="button"
              onClick={() => openCustomerForm(null)}
              className="mt-4 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              + Add Customer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-medium text-stone-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-3 pr-4 pl-6">Customer</th>
                  <th className="py-3 px-4">Channels</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Total spent</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 pr-6 pl-4 text-right">Last interaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/70">
                {filtered.map((cust) => {
                  const st = computeCustomerStats(cust.id, orders);
                  return (
                    <tr
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className="cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="py-3.5 pr-4 pl-6 font-medium text-stone-900 whitespace-nowrap dark:text-zinc-100">
                        {cust.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-500 dark:text-zinc-400">
                        {[cust.instagram, cust.phone || cust.email]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-stone-700 tabular-nums dark:text-zinc-300">
                        {st.orderCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-stone-900 tabular-nums dark:text-zinc-100">
                        {formatCurrency(st.totalSpent, business.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs font-medium tabular-nums">
                        {st.outstandingBalance > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {formatCurrency(st.outstandingBalance, business.currency)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-6 pl-4 text-right text-xs text-stone-500 whitespace-nowrap dark:text-zinc-400">
                        {cust.lastInteractionAt ? formatShortDate(cust.lastInteractionAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Profile Drawer */}
      {activeCustomer && activeStats && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-profile-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCustomerId(null);
          }}
        >
          <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-stone-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4 dark:border-zinc-800">
              <div>
                <h3
                  id="customer-profile-title"
                  className="font-display text-xl font-semibold text-stone-900 dark:text-zinc-100"
                >
                  {activeCustomer.name}
                </h3>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                  Last interaction:{' '}
                  {activeCustomer.lastInteractionAt
                    ? formatShortDate(activeCustomer.lastInteractionAt)
                    : 'Not recorded'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                aria-label="Close customer profile"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  openMessageModal({
                    customerName: activeCustomer.name,
                    order: activeStats.orders[0] || null,
                    defaultPreset:
                      activeStats.outstandingBalance > 0 ? 'payment_reminder' : 'thank_you',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Write Message
              </button>

              <button
                type="button"
                onClick={() => openCustomerForm(activeCustomer)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit details
              </button>
            </div>

            {/* Summary KPIs */}
            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 dark:border-zinc-800 dark:bg-zinc-800">
              <div className="bg-white p-3.5 dark:bg-zinc-900">
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">Total spent</p>
                <p className="mt-1 font-mono text-base font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                  {formatCurrency(activeStats.totalSpent, business.currency)}
                </p>
              </div>
              <div className="bg-white p-3.5 dark:bg-zinc-900">
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">Outstanding</p>
                <p className="mt-1 font-mono text-base font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                  {formatCurrency(activeStats.outstandingBalance, business.currency)}
                </p>
              </div>
              <div className="bg-white p-3.5 dark:bg-zinc-900">
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">Orders</p>
                <p className="mt-1 font-mono text-base font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                  {activeStats.orderCount}
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <dl className="mt-6 space-y-2.5 text-sm">
              {activeCustomer.email && (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs text-stone-500">Email</dt>
                  <dd className="text-stone-900 dark:text-zinc-100">{activeCustomer.email}</dd>
                </div>
              )}
              {activeCustomer.phone && (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs text-stone-500">Phone / WhatsApp</dt>
                  <dd className="font-mono text-xs text-stone-900 dark:text-zinc-100">
                    {activeCustomer.phone}
                  </dd>
                </div>
              )}
              {activeCustomer.instagram && (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs text-stone-500">Instagram</dt>
                  <dd className="text-stone-900 dark:text-zinc-100">{activeCustomer.instagram}</dd>
                </div>
              )}
              {activeCustomer.facebook && (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs text-stone-500">Facebook</dt>
                  <dd className="text-stone-900 dark:text-zinc-100">{activeCustomer.facebook}</dd>
                </div>
              )}
              {activeCustomer.address && (
                <div>
                  <dt className="text-xs text-stone-500">Delivery address</dt>
                  <dd className="mt-0.5 text-stone-800 dark:text-zinc-200">
                    {activeCustomer.address}
                  </dd>
                </div>
              )}
              {activeCustomer.notes && (
                <div>
                  <dt className="text-xs text-stone-500">Notes</dt>
                  <dd className="mt-0.5 text-stone-700 dark:text-zinc-300">
                    {activeCustomer.notes}
                  </dd>
                </div>
              )}
            </dl>

            {/* Order History */}
            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-zinc-800">
              <h4 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                Order History
              </h4>
              {activeStats.orders.length === 0 ? (
                <p className="mt-2 text-xs text-stone-500">No orders recorded yet.</p>
              ) : (
                <div className="mt-3 divide-y divide-stone-100 dark:divide-zinc-800">
                  {activeStats.orders.map((ord) => (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(null);
                        setActiveSection('orders');
                        setSelectedOrderId(ord.id);
                      }}
                      className="flex w-full items-center justify-between py-2.5 text-left hover:opacity-80"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-900 dark:text-zinc-100">
                          {ord.product}
                        </p>
                        <p className="text-xs text-stone-500">
                          {ord.orderNumber} · {formatShortDate(ord.orderDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                          {formatCurrency(ord.totalPrice, business.currency)}
                        </p>
                        <p className={`text-[11px] font-medium ${statusTextClass(ord.status)}`}>
                          {ord.status}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-stone-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmDelete(activeCustomer)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete customer profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cust-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h3
                id="cust-form-title"
                className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100"
              >
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Close customer form"
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="cust-name"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Full Name *
                </label>
                <input
                  id="cust-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Emma Thompson"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cust-email"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Email
                  </label>
                  <input
                    id="cust-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="emma@example.com"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-phone"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Phone / WhatsApp
                  </label>
                  <input
                    id="cust-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07700 900412"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cust-ig"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Instagram username
                  </label>
                  <input
                    id="cust-ig"
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@emmathompson"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-fb"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Facebook name
                  </label>
                  <input
                    id="cust-fb"
                    type="text"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="Emma Thompson"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cust-addr"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Address
                </label>
                <input
                  id="cust-addr"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="14 Willow Crescent, Bristol, BS8 2TH"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="cust-notes"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Notes
                </label>
                <textarea
                  id="cust-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferences, repeat customer details…"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white p-2.5 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {saving ? 'Saving…' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete ${confirmDelete?.name}?`}
        description="This removes the customer contact card from your CRM. Existing orders will remain in your order history."
        confirmLabel="Delete Customer"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const id = confirmDelete.id;
          setConfirmDelete(null);
          await deleteCustomer(id);
        }}
      />
    </div>
  );
}
