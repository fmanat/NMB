-- Entonnoir de conversion : trois étapes de plus (mission de transformation, 04/10/2026), toujours anonymes.
--  upsell_click    : clic vers l'analyse photo depuis un résultat ou l'accueil ;
--  share_click     : partage lancé (partage natif, lien copié, messagerie) depuis une carte ;
--  challenge_visit : visite d'un lien de défi (arrivée par un ami).
ALTER TABLE funnel_events DROP CONSTRAINT IF EXISTS funnel_events_kind_check;
ALTER TABLE funnel_events ADD CONSTRAINT funnel_events_kind_check CHECK (kind IN (
  'home_view', 'questionnaire_start', 'questionnaire_done', 'report_view', 'card_created', 'locked_preview',
  'upsell_click', 'share_click', 'challenge_visit'
));
