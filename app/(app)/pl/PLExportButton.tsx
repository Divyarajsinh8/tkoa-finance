"use client";

import { Document, Page, View, Text, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 36,
    backgroundColor: "#ffffff",
    color: "#111111",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 12,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
  },
  generatedAt: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowTotal: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  tableRowNetProfit: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "#eff6ff",
    borderTopWidth: 1.5,
    borderTopColor: "#3b82f6",
  },
  labelCell: {
    width: "32%",
    fontSize: 8,
    color: "#374151",
  },
  labelCellIndent: {
    width: "32%",
    fontSize: 8,
    color: "#6b7280",
    paddingLeft: 12,
  },
  labelCellBold: {
    width: "32%",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  dataCell: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
    fontFamily: "Courier",
    color: "#374151",
  },
  dataCellGreen: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
    fontFamily: "Courier",
    color: "#16a34a",
  },
  dataCellRed: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
    fontFamily: "Courier",
    color: "#dc2626",
  },
  headerCell: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
  },
  headerLabelCell: {
    width: "32%",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
  },
  sectionRow: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 3,
  },
  sectionLabel: {
    fontSize: 7,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
    textAlign: "center",
  },
});

function fmtINR(paise: number): string {
  const r = paise / 100;
  if (Math.abs(r) >= 10000000) return `₹${(r / 10000000).toFixed(2)}Cr`;
  if (Math.abs(r) >= 100000) return `₹${(r / 100000).toFixed(2)}L`;
  return `₹${r.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface ExportRow {
  label: string;
  values: number[];
  isTotal?: boolean;
  isNetProfit?: boolean;
  indent?: boolean;
  isSection?: boolean;
}

interface ExportCol {
  key: string;
  label: string;
}

interface ExportData {
  cols: ExportCol[];
  rows: ExportRow[];
  generatedAt: string;
}

function PLDocument({ data }: { data: ExportData }) {
  const { cols, rows, generatedAt } = data;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>TKOA Private Limited</Text>
          <Text style={styles.subtitle}>Profit & Loss Statement</Text>
          <Text style={styles.generatedAt}>Generated: {generatedAt} · Internal Use Only</Text>
        </View>

        {/* Column headers */}
        <View style={styles.tableHeader}>
          <Text style={styles.headerLabelCell}>Category</Text>
          {cols.map(c => (
            <Text key={c.key} style={styles.headerCell}>{c.label}</Text>
          ))}
          {cols.length > 1 && <Text style={styles.headerCell}>Total</Text>}
        </View>

        {/* Rows */}
        {rows.map((row, i) => {
          if (row.isSection) {
            return (
              <View key={i} style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>{row.label}</Text>
              </View>
            );
          }

          const rowTotal = row.values.reduce((s, v) => s + v, 0);
          const rowStyle = row.isNetProfit
            ? styles.tableRowNetProfit
            : row.isTotal
            ? styles.tableRowTotal
            : styles.tableRow;

          const labelStyle = row.isTotal || row.isNetProfit
            ? styles.labelCellBold
            : row.indent
            ? styles.labelCellIndent
            : styles.labelCell;

          return (
            <View key={i} style={rowStyle}>
              <Text style={labelStyle}>{row.label}</Text>
              {row.values.map((val, j) => {
                const style = row.isNetProfit
                  ? val >= 0 ? styles.dataCellGreen : styles.dataCellRed
                  : row.label.includes("Revenue") || row.label.includes("Profit") || row.label.includes("Income")
                  ? styles.dataCellGreen
                  : row.label.includes("Expense") || row.label.includes("Cost")
                  ? styles.dataCellRed
                  : styles.dataCell;

                return (
                  <Text key={j} style={style}>
                    {val === 0 ? (row.isTotal || row.isNetProfit ? fmtINR(0) : "—") : fmtINR(val)}
                  </Text>
                );
              })}
              {cols.length > 1 && (
                <Text style={row.isNetProfit
                  ? rowTotal >= 0 ? styles.dataCellGreen : styles.dataCellRed
                  : styles.dataCell}>
                  {rowTotal === 0 ? "—" : fmtINR(rowTotal)}
                </Text>
              )}
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            TKOA Finance Command Center · finance.tkoa.in · Confidential
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default function PLExportButton({ data }: { data: ExportData }) {
  return (
    <PDFDownloadLink
      document={<PLDocument data={data} />}
      fileName={`TKOA-PL-${new Date().toISOString().split("T")[0]}.pdf`}
    >
      {({ loading }) => (
        <button
          className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          disabled={loading}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {loading ? "Preparing…" : "Export PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
