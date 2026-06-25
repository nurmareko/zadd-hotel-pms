import { StyleSheet } from "@react-pdf/renderer";

export const PDF_BRAND_NAME = "ZADD Hotel Management";

export const printColors = {
  paper: "#ffffff",
  text: "#1f2933",
  muted: "#5f6b7a",
  rule: "#d8dde3",
  lightRule: "#e8ecef",
  headerFill: "#f3f5f7",
  subtleFill: "#f8f9fa",
  note: "#7a4b16",
};

export const printStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: printColors.text,
    backgroundColor: printColors.paper,
  },
  compactPage: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: printColors.text,
    backgroundColor: printColors.paper,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: printColors.rule,
    paddingBottom: 10,
    marginBottom: 12,
  },
  centeredHeader: {
    borderBottomWidth: 1,
    borderBottomColor: printColors.rule,
    paddingBottom: 10,
    marginBottom: 12,
    textAlign: "center",
  },
  hotelName: {
    fontSize: 15,
    fontWeight: 700,
  },
  muted: {
    color: printColors.muted,
  },
  title: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  block: {
    borderWidth: 1,
    borderColor: printColors.rule,
    marginBottom: 10,
  },
  blockHeader: {
    backgroundColor: printColors.headerFill,
    color: printColors.text,
    borderBottomWidth: 1,
    borderBottomColor: printColors.rule,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 8,
    fontWeight: 700,
  },
  blockBody: {
    padding: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  field: {
    width: "50%",
    marginBottom: 6,
  },
  fieldLabel: {
    color: printColors.muted,
    fontSize: 7,
  },
  fieldValue: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: printColors.rule,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: printColors.headerFill,
    color: printColors.text,
    fontSize: 7,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: printColors.lightRule,
    minHeight: 22,
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  right: {
    textAlign: "right",
  },
  summary: {
    width: 220,
    marginLeft: "auto",
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: printColors.lightRule,
    paddingVertical: 4,
  },
  strong: {
    fontWeight: 700,
  },
  totalText: {
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: printColors.rule,
    paddingTop: 8,
  },
});
