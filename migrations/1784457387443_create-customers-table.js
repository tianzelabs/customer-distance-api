/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('customers', {
    id: { type: 'bigserial', primaryKey: true },
    name: { type: 'text', notNull: true },
    telepules: { type: 'text', notNull: true },
    lat: { type: 'double precision', notNull: false },
    lon: { type: 'double precision', notNull: false },
    budget: { type: 'integer', notNull: false },
    note: { type: 'text', notNull: false },
    country_code: { type: 'varchar(2)', notNull: false },
  });

  pgm.addConstraint('customers', 'customers_name_telepules_key', {
    unique: ['name', 'telepules'],
  });

  pgm.addConstraint('customers', 'customers_lat_check', {
    check: 'lat IS NULL OR lat BETWEEN -90 AND 90',
  });

  pgm.addConstraint('customers', 'customers_lon_check', {
    check: 'lon IS NULL OR lon BETWEEN -180 AND 180',
  });

  pgm.addConstraint('customers', 'customers_lat_lon_pair_check', {
    check:
      '(lat IS NULL AND lon IS NULL) OR (lat IS NOT NULL AND lon IS NOT NULL)',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('customers');
};
