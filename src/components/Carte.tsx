"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Evenement } from "@/lib/types";

/**
 * Fond de carte IGN. Gratuit, perenne, licence etalab, et couverture francaise
 * bien meilleure qu'un fond mondial. Les offres gratuites de Stadia et Jawg
 * interdisent l'usage commercial, et les tuiles OpenStreetMap officielles sont
 * revocables sans preavis : ni l'une ni l'autre ne conviennent a un service
 * qu'on veut laisser tourner.
 */
const TUILES =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM" +
  "&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&FORMAT=image/png";

/**
 * Style minimal, ecrit ici plutot que charge depuis l'IGN.
 *
 * Le style vectoriel officiel conviendrait sans doute aussi : il a d'abord ete
 * soupconne d'etre en cause dans une carte qui restait vide, mais le vrai
 * coupable etait ailleurs, un serveur laisse en place pendant une
 * reconstruction, qui servait un fragment de code perime en erreur 500. Le
 * diagnostic accusait donc le style pendant que la panne etait dans la facon
 * de lancer le serveur.
 *
 * Les tuiles image sont conservees pour une raison qui tient sans ce faux
 * proces : elles n'exigent aucune negociation. Une adresse, un gabarit, et
 * c'est tout, la ou le vectoriel demande un fichier de metadonnees, un jeu de
 * glyphes et une planche de symboles. Le fond est moins fin et ne se reteinte
 * pas en theme sombre ; en echange il a trois points de defaillance en moins.
 */
const STYLE = {
  version: 8 as const,
  sources: {
    ign: {
      type: "raster" as const,
      tiles: [TUILES],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: "IGN - Geoplateforme",
    },
  },
  layers: [
    { id: "fond", type: "raster" as const, source: "ign" },
  ],
};

export function Carte({
  evenements,
  centre,
  actif,
  onChoisir,
}: {
  evenements: Evenement[];
  centre: { lat: number; lng: number };
  actif: string | null;
  onChoisir: (slug: string | null) => void;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<MapLibreMap | null>(null);
  const marqueurs = useRef<Map<string, Marker>>(new Map());
  // Le style se charge de facon asynchrone. Sans ce drapeau, l'effet qui pose
  // les marqueurs s'execute avant que la carte existe, ne fait rien, et n'est
  // jamais relance : la carte resterait sans aucun point.
  const [prete, setPrete] = useState(false);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;

    const m = new MapLibreMap({
      container: conteneur.current,
      style: STYLE,
      center: [centre.lng, centre.lat],
      zoom: 11,
      attributionControl: false,
    });
    m.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "IGN - Geoplateforme",
      }),
    );
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    carte.current = m;
    setPrete(true);

    /**
     * Sur telephone, la carte est masquee en CSS tant qu'on est sur la liste.
     * MapLibre s'initialise alors dans un conteneur de taille nulle, en deduit
     * qu'il n'a rien a afficher, et ne demande AUCUNE tuile. Rien n'echoue,
     * rien n'est signale : la carte s'ouvre simplement vide, avec les
     * marqueurs poses sur du blanc.
     *
     * L'observateur previent la carte des qu'elle reprend une taille.
     */
    const observateur = new ResizeObserver(([entree]) => {
      if (!entree) return;
      const { width, height } = entree.contentRect;
      if (width > 0 && height > 0) carte.current?.resize();
    });
    if (conteneur.current) observateur.observe(conteneur.current);

    return () => {
      observateur.disconnect();
      carte.current?.remove();
      carte.current = null;
      marqueurs.current.clear();
    };
    // Le centre initial ne doit pas recreer la carte : il est suivi plus bas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marqueurs. On recree l'ensemble a chaque changement de resultats : sur
  // quelques dizaines de points c'est instantane, et ca evite un suivi de
  // differences qui serait la seule source de bogues de cette carte.
  useEffect(() => {
    const m = carte.current;
    if (!m) return;

    for (const mk of marqueurs.current.values()) mk.remove();
    marqueurs.current.clear();

    for (const e of evenements) {
      const pastille = document.createElement("button");
      pastille.type = "button";
      pastille.setAttribute("aria-label", `${e.titre_affiche}, ${e.commune}`);
      pastille.className = "pastille";
      pastille.style.cssText =
        "width:18px;height:18px;border-radius:9999px;border:2px solid var(--papier);" +
        "background:var(--tampon);cursor:pointer;padding:0;min-height:0;";
      pastille.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onChoisir(e.slug);
      });

      const mk = new Marker({ element: pastille })
        .setLngLat([e.longitude, e.latitude])
        .addTo(m);
      marqueurs.current.set(e.slug, mk);
    }

    if (evenements.length > 0) {
      const bornes = new LngLatBounds();
      for (const e of evenements) bornes.extend([e.longitude, e.latitude]);
      bornes.extend([centre.lng, centre.lat]);
      m.fitBounds(bornes, { padding: 48, maxZoom: 13, duration: 0 });
    } else {
      m.jumpTo({ center: [centre.lng, centre.lat], zoom: 11 });
    }
  }, [evenements, centre.lat, centre.lng, onChoisir, prete]);

  // Mise en evidence de la selection. La taille change, pas seulement la
  // couleur : un daltonien doit voir la difference lui aussi.
  useEffect(() => {
    for (const [slug, mk] of marqueurs.current) {
      const el = mk.getElement();
      const choisi = slug === actif;
      el.style.width = choisi ? "26px" : "18px";
      el.style.height = choisi ? "26px" : "18px";
      el.style.zIndex = choisi ? "10" : "1";
      el.style.background = choisi ? "var(--encre)" : "var(--tampon)";
    }
  }, [actif, prete]);

  return (
    <div
      ref={conteneur}
      className="carte-fond h-full w-full"
      role="application"
      aria-label="Carte des brocantes"
    />
  );
}
