import "server-only";
import QRCode from "qrcode";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { verifyUrl } from "@/lib/certificate-hash";

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#14532d" },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 6,
  },
  muted: { color: "#6b7280" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  card: { width: "50%", paddingRight: 10, paddingBottom: 10 },
  cardInner: { borderWidth: 1, borderColor: "#d1d5db", padding: 10 },
  big: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#d1d5db",
    paddingVertical: 4,
  },
  head: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#111827",
    paddingBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  c1: { width: "16%" },
  c2: { width: "30%" },
  c3: { width: "28%" },
  c4: { width: "12%", textAlign: "right" },
  c5: { width: "14%", textAlign: "right" },
  note: { marginTop: 14, fontSize: 8.5, lineHeight: 1.45, color: "#4b5563" },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
});

export interface ReportLine {
  date: string;
  title: string;
  recipient: string;
  recipientLicense: string | null;
  kg: number;
}
export interface ReportData {
  serial: string;
  hash: string;
  donorName: string;
  donorLicense: string | null;
  label: string; // "Q3 2026"
  periodText: string; // "1 July 2026 to 30 September 2026"
  generatedAt: Date;
  deliveries: number;
  foodKg: number;
  co2eKg: number;
  waterL: number;
  meals: number;
  lines: ReportLine[];
}

const n = (x: number, d = 0) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  }).format(x);

export async function renderReportPdf(r: ReportData): Promise<Buffer> {
  const url = verifyUrl(r.serial, r.hash);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  const shown = r.lines.slice(0, 200);
  const doc = (
    <Document
      title={`FoodLink ${r.label} impact report ${r.serial}`}
      author="FoodLink"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Food donation and environmental impact report</Text>
        <Text style={{ marginTop: 4 }}>
          {r.donorName} - {r.label}
        </Text>
        <Text style={s.muted}>
          {r.periodText}
          {r.donorLicense ? ` - Licence: ${r.donorLicense}` : ""}
        </Text>

        <Text style={s.h2}>Impact summary</Text>
        <View style={s.grid}>
          {[
            [n(r.foodKg, 2) + " kg", "Food diverted from waste"],
            [n(r.meals), "Standard meals provided (0.4 kg per meal)"],
            [
              n(r.co2eKg, 2) + " kg",
              "CO2e emissions diverted (2.5 kg CO2e per kg of food)",
            ],
            [
              n(r.waterL) + " L",
              "Water footprint conserved (1,200 L per kg of food)",
            ],
          ].map(([big, label]) => (
            <View key={label} style={s.card}>
              <View style={s.cardInner}>
                <Text style={s.big}>{big}</Text>
                <Text style={[s.muted, { marginTop: 2 }]}>{label}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={s.muted}>
          {r.deliveries} completed deliveries in the quarter.
        </Text>

        <Text style={s.h2}>Donation record</Text>
        <View style={s.head}>
          <Text style={s.c1}>Date</Text>
          <Text style={s.c2}>Batch</Text>
          <Text style={s.c3}>Received by</Text>
          <Text style={s.c4}>Licence</Text>
          <Text style={s.c5}>Weight (kg)</Text>
        </View>
        {shown.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.c1}>{l.date}</Text>
            <Text style={s.c2}>{l.title}</Text>
            <Text style={s.c3}>{l.recipient}</Text>
            <Text style={s.c4}>{l.recipientLicense ?? "-"}</Text>
            <Text style={s.c5}>{n(l.kg, 2)}</Text>
          </View>
        ))}
        {r.lines.length > shown.length && (
          <Text style={s.muted}>
            ...and {r.lines.length - shown.length} more deliveries (totals above
            include all).
          </Text>
        )}
        {r.lines.length === 0 && (
          <Text style={s.muted}>No completed deliveries in this quarter.</Text>
        )}

        <Text style={s.note}>
          This report is a record of food donated through FoodLink and delivered
          with the receiver's confirmation code. It is not tax advice and does
          not state a monetary value: any deduction depends on the recipient's
          registration and on the valuation and rules your accountant applies.
          Impact figures use fixed conversion factors and are estimates for CSR
          reporting.
        </Text>
        <View style={s.footer} fixed>
          <View>
            <Text style={s.muted}>
              Report no. {r.serial} - generated{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeZone: "Asia/Kolkata",
              }).format(r.generatedAt)}
            </Text>
            <Text style={s.muted}>
              Verification code {r.hash.slice(0, 16).toUpperCase()} -{" "}
              {url.split("?")[0]}
            </Text>
          </View>
          <Image src={qr} style={{ width: 56, height: 56 }} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
