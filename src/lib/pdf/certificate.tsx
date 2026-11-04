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
  page: { padding: 36, backgroundColor: "#ffffff", fontFamily: "Helvetica" },
  frame: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#14532d",
    padding: 28,
    justifyContent: "space-between",
  },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#14532d" },
  title: { fontSize: 34, fontFamily: "Helvetica-Bold", marginTop: 14 },
  lead: { fontSize: 13, marginTop: 18, color: "#374151" },
  name: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    color: "#14532d",
  },
  body: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 1.5,
    color: "#374151",
    maxWidth: 560,
  },
  stats: { flexDirection: "row", marginTop: 20 },
  stat: { marginRight: 36 },
  statNum: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  statLabel: { fontSize: 10, color: "#6b7280", marginTop: 2 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  small: { fontSize: 9, color: "#6b7280", marginTop: 3 },
  qr: { width: 92, height: 92 },
});

export interface CertificateData {
  serial: string;
  hash: string;
  holderName: string;
  deliveriesCount: number;
  foodKg: number;
  meals: number;
  points: number;
  issuedAt: Date;
}

const date = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  }).format(d);

export async function renderCertificatePdf(
  c: CertificateData,
): Promise<Buffer> {
  const url = verifyUrl(c.serial, c.hash);
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 280,
    errorCorrectionLevel: "M",
  });
  const doc = (
    <Document title={`FoodLink certificate ${c.serial}`} author="FoodLink">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          <View>
            <Text style={s.brand}>FoodLink</Text>
            <Text style={s.title}>Certificate of Volunteer Service</Text>
            <Text style={s.lead}>This certifies that</Text>
            <Text style={s.name}>{c.holderName}</Text>
            <Text style={s.body}>
              has rescued surplus food and carried it to people who need it,
              completing verified deliveries on the FoodLink platform. Each
              delivery was confirmed by the donor and the receiver with one-time
              codes.
            </Text>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statNum}>{c.deliveriesCount}</Text>
                <Text style={s.statLabel}>deliveries completed</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{c.foodKg.toFixed(1)} kg</Text>
                <Text style={s.statLabel}>food rescued</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{c.meals}</Text>
                <Text style={s.statLabel}>standard meals</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{c.points}</Text>
                <Text style={s.statLabel}>points earned</Text>
              </View>
            </View>
          </View>
          <View style={s.footer}>
            <View>
              <Text style={{ fontSize: 11 }}>Issued {date(c.issuedAt)}</Text>
              <Text style={s.small}>Certificate no. {c.serial}</Text>
              <Text style={s.small}>
                Verification code {c.hash.slice(0, 16).toUpperCase()}
              </Text>
              <Text style={s.small}>
                Scan the QR code, or open {url.split("?")[0]}
              </Text>
            </View>
            <Image src={qr} style={s.qr} />
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
