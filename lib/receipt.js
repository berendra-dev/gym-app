'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generate a PDF receipt for a payment.
 * @param {Object} opts
 * @param {Object} opts.gym  - { name, address, phone, logoURL }
 * @param {Object} opts.member - { name, phone, email, id }
 * @param {Object} opts.payment - { receiptNo, amount, plan, mode, paymentDate,
 *                                  previousExpiry, newExpiry, notes, recordedByName, wasExpired }
 */
export async function generateReceiptPDF({ gym, member, payment }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const orange = [234, 88, 12]      // tailwind orange-600
  const slate = [71, 85, 105]
  const dark = [15, 23, 42]

  // ---- Header ----
  // Try to embed logo (best-effort; ignore CORS failures)
  let logoLoaded = false
  if (gym?.logoURL) {
    try {
      const dataUrl = await fetchAsDataURL(gym.logoURL)
      if (dataUrl) {
        doc.addImage(dataUrl, 'PNG', 15, 12, 22, 22, undefined, 'FAST')
        logoLoaded = true
      }
    } catch { /* ignore */ }
  }

  doc.setFontSize(20)
  doc.setTextColor(...dark)
  doc.setFont(undefined, 'bold')
  doc.text(gym?.name || 'Gym', logoLoaded ? 42 : 15, 22)

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...slate)
  if (gym?.address) doc.text(gym.address, logoLoaded ? 42 : 15, 28)
  if (gym?.phone) doc.text(`Phone: ${gym.phone}`, logoLoaded ? 42 : 15, 33)

  // Top-right: RECEIPT label & number
  doc.setFontSize(18)
  doc.setTextColor(...orange)
  doc.setFont(undefined, 'bold')
  doc.text('RECEIPT', W - 15, 22, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(...slate)
  doc.setFont(undefined, 'normal')
  doc.text(`No: ${payment.receiptNo}`, W - 15, 28, { align: 'right' })
  doc.text(`Date: ${payment.paymentDate}`, W - 15, 33, { align: 'right' })

  // Divider
  doc.setDrawColor(...orange)
  doc.setLineWidth(0.6)
  doc.line(15, 40, W - 15, 40)

  // ---- Member box ----
  doc.setFontSize(11)
  doc.setTextColor(...dark)
  doc.setFont(undefined, 'bold')
  doc.text('Billed To', 15, 50)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  doc.text(member?.name || '-', 15, 56)
  if (member?.phone) doc.text(`Phone: ${member.phone}`, 15, 61)
  if (member?.email) doc.text(`Email: ${member.email}`, 15, 66)
  if (member?.id) {
    doc.setTextColor(...slate)
    doc.setFontSize(8)
    doc.text(`Member ID: ${member.id}`, 15, 71)
  }

  // ---- Payment table ----
  autoTable(doc, {
    startY: 80,
    head: [['Description', 'Plan', 'Validity', 'Amount']],
    body: [[
      payment.wasExpired
        ? 'Membership Reactivation & Renewal'
        : 'Membership Renewal',
      String(payment.plan || '-'),
      `${payment.previousExpiry || '—'}  ->  ${payment.newExpiry}`,
      `INR ${Number(payment.amount).toLocaleString()}`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: orange, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  })

  let y = doc.lastAutoTable.finalY + 6

  // ---- Totals ----
  doc.setFontSize(11)
  doc.setTextColor(...dark)
  doc.setFont(undefined, 'bold')
  doc.text('Total Paid:', W - 60, y)
  doc.text(`INR ${Number(payment.amount).toLocaleString()}`, W - 15, y, { align: 'right' })
  y += 6

  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...slate)
  doc.text(`Payment Mode: ${(payment.mode || 'cash').toUpperCase()}`, 15, y)
  if (payment.recordedByName) doc.text(`Recorded by: ${payment.recordedByName}`, 15, y + 5)
  if (payment.notes) {
    const lines = doc.splitTextToSize(`Notes: ${payment.notes}`, W - 30)
    doc.text(lines, 15, y + 10)
    y += lines.length * 5
  }

  // ---- Footer ----
  doc.setDrawColor(220)
  doc.line(15, 270, W - 15, 270)
  doc.setFontSize(9)
  doc.setTextColor(...slate)
  doc.text('This is a system generated receipt. Thank you for your payment!',
    W / 2, 278, { align: 'center' })
  doc.text(`Generated on ${new Date().toLocaleString()}`, W / 2, 283, { align: 'center' })

  doc.save(`Receipt-${payment.receiptNo}.pdf`)
}

async function fetchAsDataURL(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

export function makeReceiptNo(gymId) {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  const prefix = (gymId || '').slice(0, 4).toUpperCase() || 'GYM'
  return `RCP-${prefix}-${ymd}-${rand}`
}
