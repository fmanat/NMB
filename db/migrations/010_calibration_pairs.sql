-- Calibration du moteur photo, version 2 (photo-report/2) : paires (mesure par la carte de référence, estimation du modèle sans la carte).
-- Une ligne par analyse dont la mesure a pu être calibrée sur la carte. AUCUNE autre donnée : ni photo, ni identifiant (pas même
-- de clé primaire), ni date, ni état, ni lien avec un rapport ou une tentative. Sert uniquement au graphique de l'administration,
-- pour détecter si le modèle ramène ses estimations vers la moyenne.
CREATE TABLE calibration_pairs (
  card_length_cm  real NOT NULL CHECK (card_length_cm > 0),
  model_length_cm real NOT NULL CHECK (model_length_cm > 0),
  card_girth_cm   real NOT NULL CHECK (card_girth_cm > 0),
  model_girth_cm  real NOT NULL CHECK (model_girth_cm > 0)
);
