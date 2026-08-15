using System.Diagnostics.Eventing.Reader;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Common
{
    public class GlucoseThresholds
    {
        public const byte Normal = 0;
        public const byte Type1 = 1;
        public const byte Type2 = 2;
        public const byte Pregnancy = 3;

        public static bool IsAbnormal(byte diabetesType, decimal value, MetricContext? context)
        {
            return diabetesType switch
            {
                Normal => IsNormalAbnormal(value, context),
                Type1 => IsType1Abnormal(value, context),
                Type2 => IsType2Abnormal(value, context),
                Pregnancy => IsPregnancyAbnormal(value, context),
                _ => throw new ArgumentOutOfRangeException(nameof(diabetesType), "Invalid diabetes type")
            };
        }
        private static bool IsNormalAbnormal(decimal value, MetricContext? context) =>
            context switch
            {
                MetricContext.BeforeMeal => value >= 5.6m,
                MetricContext.AfterMeal => value >= 7.8m,
                _ => false
            };

        private static bool IsType1Abnormal (decimal value, MetricContext? context) =>
            context switch
            {
                MetricContext.BeforeMeal => value < 4.0m || value > 8.0m,
                MetricContext.AfterMeal => value < 4.0m || value > 10m,
                _ => false
            };
        private static bool IsType2Abnormal(decimal value, MetricContext? context) =>
            context switch
            {
                MetricContext.BeforeMeal => value < 4.4m || value > 7.2m,
                MetricContext.AfterMeal =>  value >= 10.0m,
                _ => false
            };
        private static bool IsPregnancyAbnormal(decimal value, MetricContext? context) =>
            context switch
            {
                MetricContext.BeforeMeal => value >= 5.3m,
                MetricContext.AfterMeal => value >= 6.7m,
                _ => false
            };
    }
}
