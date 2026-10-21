// Well-known companies shown under the hero, a different set per language so each
// market sees its own names. Each links to that company's domain page. They are
// examples to look up, not customers, and the copy around them says so.

import {
  siAdidas, siAirbus, siBarclays, siBmw, siBosch, siCaixabank, siCarrefour, siDeezer, siDeliveroo,
  siDeutschetelekom, siGlovo, siHsbc, siIberia, siLufthansa, siMovistar, siOrange, siPeugeot, siRenault, siRevolut,
  siSap, siSchneiderelectric, siSeat, siShopify, siSiemens, siStripe, siTelefonica, siTypeform, siUbisoft,
  siUnilever, siVodafone, siZalando, siZara,
} from "simple-icons"
import type { Locale } from "@/i18n/locales"

export interface ShowcaseCompany {
  name: string
  domain: string
  /** SVG path in a 24×24 box. */
  path: string
}

const company = (icon: { title: string; path: string }, domain: string): ShowcaseCompany => ({
  name: icon.title,
  domain,
  path: icon.path,
})

export const SHOWCASE: Record<Locale, ShowcaseCompany[]> = {
  en: [
    company(siStripe, "stripe.com"),
    company(siHsbc, "hsbc.com"),
    company(siBarclays, "barclays.co.uk"),
    company(siUnilever, "unilever.com"),
    company(siVodafone, "vodafone.com"),
    company(siShopify, "shopify.com"),
    company(siRevolut, "revolut.com"),
    company(siDeliveroo, "deliveroo.co.uk"),
  ],
  de: [
    company(siSap, "sap.com"),
    company(siSiemens, "siemens.com"),
    company(siBosch, "bosch.com"),
    company(siBmw, "bmw.de"),
    company(siAdidas, "adidas.com"),
    company(siLufthansa, "lufthansa.com"),
    company(siDeutschetelekom, "telekom.de"),
    company(siZalando, "zalando.de"),
  ],
  fr: [
    company(siAirbus, "airbus.com"),
    company(siRenault, "renault.fr"),
    company(siOrange, "orange.fr"),
    company(siPeugeot, "peugeot.fr"),
    company(siCarrefour, "carrefour.fr"),
    company(siSchneiderelectric, "se.com"),
    company(siUbisoft, "ubisoft.com"),
    company(siDeezer, "deezer.com"),
  ],
  es: [
    company(siZara, "zara.com"),
    company(siTelefonica, "telefonica.com"),
    company(siSeat, "seat.es"),
    company(siIberia, "iberia.com"),
    company(siCaixabank, "caixabank.es"),
    company(siGlovo, "glovoapp.com"),
    company(siTypeform, "typeform.com"),
    company(siMovistar, "movistar.es"),
  ],
}
