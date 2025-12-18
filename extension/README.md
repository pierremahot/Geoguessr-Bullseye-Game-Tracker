# **Bullseye Game Tracker \- Chrome Extension**

Une extension Chrome pour sauvegarder automatiquement et analyser vos scores de parties "Bullseye" sur GeoGuessr.

## **Description**

Cette extension fonctionne en arrière-plan pour détecter automatiquement la fin d'une partie de GeoGuessr Bullseye. Lorsque l'écran de fin de partie s'affiche, l'extension récupère le score final, la liste des joueurs et un lien vers la partie, puis les sauvegarde automatiquement dans le stockage local de votre navigateur.

Vous pouvez ensuite consulter un historique complet de vos parties et analyser vos performances et celles de vos coéquipiers via une page de statistiques détaillée.

## **Fonctionnalités**

- **Sauvegarde Automatique :** Détecte l'écran de fin de partie et enregistre le jeu sans aucune action de votre part.
- **Collecte de Données :** Récupère le score final, la liste de tous les joueurs (stockée sous forme de tableau) et l'URL de la page de résultats.
- **Historique Complet :** Une page d'historique (history.html) affiche toutes les parties sauvegardées avec des options pour **trier** par colonne et **filtrer** par joueur ou date.
- **Calcul de Moyenne :** Calcule et affiche le score moyen en bas de la page d'historique, en se mettant à jour en fonction des filtres appliqués.
- **Statistiques par Joueur :** Cliquez sur le nom d'un joueur (dans le popup ou la page d'historique) pour ouvrir une page de statistiques (stats.html) qui lui est dédiée.
- **Graphiques d'Analyse :** La page de statistiques affiche :
  - Un graphique "camembert" du score moyen (sur 25 000 points).
  - Un graphique en barres du score moyen en fonction du nombre de joueurs dans la partie.
  - La "Meilleure Équipe" (le partenaire en duo avec lequel le joueur a la meilleure moyenne).
  - Un graphique linéaire de l'évolution du score moyen par jour, avec des options de zoom et de panoramique.

## **Fichiers du Projet**

- manifest.json: Fichier de configuration de l'extension. Définit les permissions, les scripts et les règles de sécurité.
- popup.html / popup.js: Gèrent la petite fenêtre popup. Affiche un historique rapide et un lien vers la page d'historique complète.
- history.html / history.js: La page d'historique complète, avec la logique de tri, de filtrage et de calcul de la moyenne.
- stats.html / stats.js: La page de statistiques des joueurs, qui génère les graphiques.
- content.js: Le script principal qui s'exécute automatiquement sur les pages GeoGuessr pour détecter la fin des parties et récupérer les données.
- lib/ (dossier) : Contient les bibliothèques JavaScript (Chart.js) nécessaires pour l'affichage des graphiques sur la page de statistiques.
- icons/ (dossier) : Contient les icônes de l'extension.

## **Instructions d'Installation**

Cette extension n'étant pas sur le Chrome Web Store, vous devez la charger manuellement en "Mode Développeur".

1. **Créez le Dossier du Projet :** Créez un dossier sur votre ordinateur (ex: geoguessr-tracker) et placez-y tous les fichiers du projet (manifest.json, popup.html, popup.js, history.html, history.js, stats.html, stats.js, content.js).
2. **Créez le Dossier lib (Étape Cruciale) :**
   - À l'intérieur de votre dossier geoguessr-tracker, créez un sous-dossier nommé lib.
   - Vous devez télécharger trois fichiers JavaScript et les placer dans ce dossier lib :
     1. **Chart.js:** Ouvrez [https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js](https://www.google.com/search?q=https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js), copiez tout le code et collez-le dans un nouveau fichier nommé lib/chart.umd.min.js.
     2. **Date Adapter:** Ouvrez [https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js](https://www.google.com/search?q=https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js), copiez le code et collez-le dans lib/chartjs-adapter-date-fns.bundle.min.js.
     3. **Zoom Plugin:** Ouvrez [https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js](https://www.google.com/search?q=https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js), copiez le code et collez-le dans lib/chartjs-plugin-zoom.min.js.
3. **Créez le Dossier icons (Optionnel) :**
   - Créez un sous-dossier icons et placez-y vos icônes icon16.png, icon48.png, et icon128.png. Si vous ne le faites pas, l'extension utilisera une icône par défaut.
4. **Ouvrez les Extensions Chrome :**
   - Ouvrez Chrome, tapez chrome://extensions dans la barre d'adresse et appuyez sur Entrée.
5. **Activez le Mode Développeur :**
   - En haut à droite, activez le bouton "Mode développeur".
6. **Chargez l'Extension :**
   - Cliquez sur le bouton **"Charger l'extension non empaquetée"**.
   - Sélectionnez le dossier principal que vous avez créé à l'étape 1 (ex: geoguessr-tracker).
7. **C'est Prêt \!**
   - L'extension "Bullseye Game Tracker" va apparaître. Épinglez-la à votre barre d'outils pour un accès facile.

## **Comment l'utiliser**

Il n'y a rien à faire \! Jouez simplement à une partie de Bullseye sur GeoGuessr. Lorsque vous arriverez à l'écran de fin de partie, le script content.js s'activera automatiquement et sauvegardera la partie.

Vous pouvez cliquer sur l'icône de l'extension à tout moment pour voir les dernières parties ou cliquer sur "View Full History" pour accéder à la page d'historique et de statistiques.
