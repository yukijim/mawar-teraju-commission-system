-- ============================================================
-- SCHEMA: Sistem Pengurusan Komisyen Dispatcher
-- Syarikat: Mawar Teraju  |  Platform: semak.reekod.com
-- ============================================================
-- Nota reka bentuk (assumptions):
-- 1. Satu batch upload = satu fail Excel admin (sheet Commission + Deduction).
-- 2. Batch BOLEH partial -- tidak semua dispatcher aktif wajib ada dalam
--    setiap batch. Maka "laporan terkini" seorang dispatcher mesti dicari
--    ikut batch terbaru YANG ADA rekod dia, bukan batch terbaru overall.
-- 3. Satu IC (ic_no) boleh dikaitkan dengan LEBIH DARI SATU dispatcher_id
--    (contoh: dispatcher pindah hub / didaftar semula). Carian ikut IC
--    mesti papar semua dispatcher_id berkaitan supaya dispatcher pilih.
-- 4. ic_no_snapshot / name_snapshot pada setiap rekod komisyen & deduction
--    menyimpan nilai TEPAT seperti dalam fail Excel asal (audit trail),
--    berasingan daripada data master di jadual dispatchers.
-- ============================================================

CREATE TABLE admins (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30)  NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE dispatchers (
    id              SERIAL PRIMARY KEY,
    dispatcher_id   VARCHAR(30)  NOT NULL UNIQUE,   -- cth: NSN3052004, PJS3522008
    ic_no           VARCHAR(20)  NOT NULL,           -- TIDAK unique -- lihat nota #3
    full_name       VARCHAR(150) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active', -- active / inactive
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dispatchers_ic_no ON dispatchers (ic_no);

CREATE TABLE report_batches (
    id              SERIAL PRIMARY KEY,
    period_label    VARCHAR(60)  NOT NULL,   -- cth: "Jun 2026 - Minggu 3"
    period_start    DATE         NOT NULL,
    period_end      DATE         NOT NULL,
    source_filename VARCHAR(255) NOT NULL,
    is_partial      BOOLEAN      NOT NULL DEFAULT FALSE, -- true jika tidak cover semua dispatcher aktif
    uploaded_by     INT          NOT NULL REFERENCES admins(id),
    status          VARCHAR(20)  NOT NULL DEFAULT 'completed', -- processing / completed / failed
    uploaded_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_batches_period ON report_batches (period_start, period_end);

CREATE TABLE commission_records (
    id                        SERIAL PRIMARY KEY,
    batch_id                  INT NOT NULL REFERENCES report_batches(id) ON DELETE CASCADE,
    dispatcher_id             VARCHAR(30) NOT NULL REFERENCES dispatchers(dispatcher_id),
    ic_no_snapshot            VARCHAR(20)  NOT NULL,
    name_snapshot             VARCHAR(150) NOT NULL,
    parcel_qty                INT           NOT NULL DEFAULT 0,
    parcel_commission         DECIMAL(12,2) NOT NULL DEFAULT 0,
    extra_weight_commission   DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_commission          DECIMAL(12,2) NOT NULL DEFAULT 0,
    refund_penalty            DECIMAL(12,2) NOT NULL DEFAULT 0, -- ADD: REFUND PENALTY
    pickup_commission         DECIMAL(12,2) NOT NULL DEFAULT 0, -- ADD: PICKUP COMMISSION
    others                    DECIMAL(12,2) NOT NULL DEFAULT 0, -- ADD: OTHERS
    sorter                    DECIMAL(12,2) NOT NULL DEFAULT 0, -- ADD: SORTER
    nett_commission           DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, dispatcher_id) -- elak duplicate row dispatcher sama dalam 1 batch
);
CREATE INDEX idx_commission_dispatcher ON commission_records (dispatcher_id);

CREATE TABLE deduction_records (
    id                  SERIAL PRIMARY KEY,
    batch_id            INT NOT NULL REFERENCES report_batches(id) ON DELETE CASCADE,
    dispatcher_id       VARCHAR(30) NOT NULL REFERENCES dispatchers(dispatcher_id),
    ic_no_snapshot      VARCHAR(20)  NOT NULL,
    name_snapshot       VARCHAR(150) NOT NULL,
    advance             DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: ADVANCE
    pending_cod         DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: PENDING COD
    hq_penalty          DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: HQ PENALTY
    duitnow_penalty     DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: DUITNOW PENALTY
    late_cod_penalty    DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: LATE COD PENALTY
    lost_individual     DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: LOST INDIVIDUAL
    lost_parcel_hub     DECIMAL(12,2) NOT NULL DEFAULT 0, -- DEDUCTION: LOST PARCEL HUB
    total_deduction     DECIMAL(12,2) NOT NULL DEFAULT 0, -- dikira: jumlah semua deduction di atas
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, dispatcher_id)
);
CREATE INDEX idx_deduction_dispatcher ON deduction_records (dispatcher_id);

CREATE TABLE report_downloads (
    id              SERIAL PRIMARY KEY,
    dispatcher_id   VARCHAR(30) NOT NULL REFERENCES dispatchers(dispatcher_id),
    batch_id        INT NOT NULL REFERENCES report_batches(id),
    report_type     VARCHAR(20) NOT NULL, -- 'commission' / 'deduction'
    downloaded_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address      VARCHAR(45)
);
CREATE INDEX idx_downloads_dispatcher ON report_downloads (dispatcher_id);

-- ============================================================
-- CONTOH QUERY: Flow carian dispatcher
-- ============================================================

-- Langkah 1a: Jika carian ialah Dispatcher ID -- terus ambil.
-- SELECT * FROM dispatchers WHERE dispatcher_id = :input;

-- Langkah 1b: Jika carian ialah IC No. -- boleh return >1 baris.
-- SELECT * FROM dispatchers WHERE ic_no = :input;
-- -> jika >1 baris, papar senarai (dispatcher_id + status) untuk dispatcher pilih.

-- Langkah 2: Selepas dispatcher_id ditetapkan, senaraikan SEMUA period
-- yang ada rekod dia (sokong batch partial -- bukan semua batch ada semua dispatcher).
-- SELECT b.id, b.period_label, b.period_start, b.period_end
-- FROM report_batches b
-- JOIN commission_records c ON c.batch_id = b.id
-- WHERE c.dispatcher_id = :dispatcher_id
-- ORDER BY b.period_start DESC;

-- Langkah 3: Dispatcher pilih period -> ambil rekod komisyen & deduction
-- untuk batch_id + dispatcher_id tersebut untuk jana PDF.
