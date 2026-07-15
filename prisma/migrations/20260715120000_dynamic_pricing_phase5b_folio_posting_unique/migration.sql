-- CreateIndex
CREATE UNIQUE INDEX "folio_line_item_reservation_night_id_article_id_key" ON "folio_line_item"("reservation_night_id", "article_id");
