import React from "react";
import { siteConfig } from "../lib/site";

export function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
        publisher: {
          "@id": `${siteConfig.url}/#organization`,
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: {
          "@type": "ImageObject",
          url: `${siteConfig.url}/icon.svg`,
        },
        sameAs: [
          siteConfig.links.twitter,
          siteConfig.links.youtube,
          siteConfig.links.linkedin,
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: siteConfig.name,
        operatingSystem: "Web",
        applicationCategory: "MultimediaApplication",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "0",
          highPrice: "79",
          offerCount: "3",
        },
        description: siteConfig.description,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

