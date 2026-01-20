SELECT COUNT(*) as total_properties,
       COUNT(parcelNumber) as with_parcel,
       COUNT(*) - COUNT(parcelNumber) as null_parcels
FROM properties;
