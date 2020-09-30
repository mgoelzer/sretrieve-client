export const config = {
  protocolName: '/fil/simple-retrieve/0.0.1',
  mandatoryPaymentIntervalInBytes: +process.env.MANDATORY_PAYMENT_INTERVAL_IN_BYTES || 1048576, // 1 mb
  mandatoryPaymentIntervalIncreaseInBytes: +process.env.MANDATORY_PAYMENT_INTERVAL_INCREASE_IN_BYTES || 10485760, // 10 mb
}
