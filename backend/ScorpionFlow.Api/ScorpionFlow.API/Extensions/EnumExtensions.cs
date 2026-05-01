using System.Globalization;

namespace ScorpionFlow.API.Extensions;

public static class EnumExtensions
{
    public static T ParseApiEnum<T>(string value) where T : struct, Enum
    {
        var normalized = string.Concat(value.Split('_', '-', ' ').Select(x => CultureInfo.InvariantCulture.TextInfo.ToTitleCase(x))).Replace(" ", "");
        return Enum.TryParse<T>(normalized, ignoreCase: true, out var result) ? result : default;
    }

    public static string ToApiString(this Enum value)
    {
        var chars = value.ToString().SelectMany((c, i) => i > 0 && char.IsUpper(c) ? new[] { '_', char.ToLowerInvariant(c) } : new[] { char.ToLowerInvariant(c) });
        return new string(chars.ToArray());
    }
}
