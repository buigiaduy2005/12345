using System.Runtime.InteropServices;
using System.Text;

namespace InsiderThreat.MonitorAgent.Services;

/// <summary>
/// Uses Win32 APIs to read the actual text content from focused input fields.
/// This is critical for Vietnamese text capture, where the keyboard hook only captures
/// raw Latin keystrokes (e.g., "nghi3 vie6c") while the actual IME output is "nghỉ việc".
/// 
/// When the user presses Enter, this service reads the composed text from the
/// focused control using Win32 SendMessage(WM_GETTEXT) and COM IUIAutomation.
/// </summary>
public class TextCaptureService
{
    private readonly ILogger<TextCaptureService> _logger;

    // Win32 APIs
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    private static extern IntPtr GetFocus();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int SendMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, StringBuilder lParam);

    [DllImport("user32.dll")]
    private static extern int SendMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    // COM IUIAutomation interfaces for .NET 8 (defined inline to avoid .NET Framework dependency)
    [ComImport, Guid("ff48dba4-60ef-4201-aa87-54103eef594e")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IUIAutomation
    {
        // We only need GetFocusedElement
        void _OnlyNeededMethods1(); // CompareElements
        void _OnlyNeededMethods2(); // CompareRuntimeIds
        void _OnlyNeededMethods3(); // GetRootElement
        void _OnlyNeededMethods4(); // ElementFromHandle
        void _OnlyNeededMethods5(); // ElementFromPoint
        [PreserveSig]
        int GetFocusedElement(out IUIAutomationElement element);
    }

    [ComImport, Guid("d22108aa-8ac5-49a5-837b-37bbb3d7591e")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IUIAutomationElement
    {
        void _Skip1(); // SetFocus
        void _Skip2(); // GetRuntimeId
        void _Skip3(); // FindFirst
        void _Skip4(); // FindAll
        void _Skip5(); // FindFirstBuildCache
        void _Skip6(); // FindAllBuildCache
        void _Skip7(); // BuildUpdatedCache
        [PreserveSig]
        int GetCurrentPropertyValue(int propertyId, out object retVal);
        void _Skip8(); // GetCurrentPropertyValueEx
        [PreserveSig]
        int GetCurrentPattern(int patternId, [MarshalAs(UnmanagedType.IUnknown)] out object patternObject);
    }

    [ComImport, Guid("a005533f-f0db-4b64-9920-6714c02dfc17")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IUIAutomationValuePattern
    {
        void _Skip1(); // SetValue
        [PreserveSig]
        int get_CurrentValue([MarshalAs(UnmanagedType.BStr)] out string retVal);
    }

    [ComImport, Guid("32eba691-ed61-4ed9-89ae-19199320656d")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IUIAutomationTextPattern
    {
        [PreserveSig]
        int get_DocumentRange(out IUIAutomationTextRange range);
    }

    [ComImport, Guid("a543e11d-37bd-4ba0-ad9c-8110b642a570")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IUIAutomationTextRange
    {
        void _Skip1(); // Clone
        void _Skip2(); // Compare
        void _Skip3(); // CompareEndpoints
        void _Skip4(); // ExpandToEnclosingUnit
        void _Skip5(); // FindAttribute
        void _Skip6(); // FindText
        void _Skip7(); // GetAttributeValue
        void _Skip8(); // GetBoundingRectangles
        void _Skip9(); // GetEnclosingElement
        [PreserveSig]
        int GetText(int maxLength, [MarshalAs(UnmanagedType.BStr)] out string text);
    }

    // CUIAutomation COM class
    [ComImport, Guid("30cbe57d-d9d0-452a-ab13-7ac5ac4825ee")]
    private class CUIAutomation { }

    private const uint WM_GETTEXT = 0x000D;
    private const uint WM_GETTEXTLENGTH = 0x000E;

    // UIA Property IDs
    private const int UIA_ValueValuePropertyId = 30045;
    private const int UIA_NamePropertyId = 30005;
    private const int UIA_ClassNamePropertyId = 30012;
    private const int UIA_ControlTypePropertyId = 30003;
    
    // UIA Pattern IDs
    private const int UIA_ValuePatternId = 10002;
    private const int UIA_TextPatternId = 10014;

    private IUIAutomation? _uiAutomation;

    public TextCaptureService(ILogger<TextCaptureService> logger)
    {
        _logger = logger;

        // Initialize COM UIAutomation
        try
        {
            _uiAutomation = (IUIAutomation)new CUIAutomation();
            _logger.LogInformation("✅ COM UIAutomation initialized successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not initialize COM UIAutomation. Will use Win32 fallback.");
        }
    }

    /// <summary>
    /// Attempt to read the actual text from the currently focused input element.
    /// Tries COM UIAutomation first, then Win32 WM_GETTEXT as fallback.
    /// </summary>
    public string? CaptureTextFromFocusedElement()
    {
        try
        {
            // Strategy 1: COM UIAutomation (for modern apps, browsers, etc.)
            var text = TryCOMUIAutomation();
            if (!string.IsNullOrWhiteSpace(text))
            {
                return text;
            }

            // Strategy 2: Win32 WM_GETTEXT (for legacy Win32 controls)
            text = TryWin32GetText();
            if (!string.IsNullOrWhiteSpace(text))
            {
                return text;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "TextCaptureService: Error capturing text");
        }

        return null;
    }

    /// <summary>
    /// Try to read text using COM UIAutomation interface.
    /// This handles Vietnamese IME input correctly because it reads the final composed text.
    /// </summary>
    private string? TryCOMUIAutomation()
    {
        if (_uiAutomation == null) return null;

        try
        {
            int hr = _uiAutomation.GetFocusedElement(out var element);
            if (hr != 0 || element == null) return null;

            return ExtractTextFromElement(element, 0);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "COM UIAutomation capture failed");
        }

        return null;
    }

    /// <summary>
    /// Recursively attempt to find text in an element or its immediate children.
    /// Zalo/Electron sometimes have the text in a nested child of the focused container.
    /// </summary>
    private string? ExtractTextFromElement(IUIAutomationElement element, int depth)
    {
        if (depth > 2) return null; // Don't go too deep to avoid performance hit

        try
        {
            // Log element info for debugging at depth 0
            if (depth == 0)
            {
                element.GetCurrentPropertyValue(UIA_ClassNamePropertyId, out var className);
                element.GetCurrentPropertyValue(UIA_ControlTypePropertyId, out var controlType);
                _logger.LogDebug("Focused element: Class={Class}, Type={Type}", className, controlType);
            }

            // 1. Try TextPattern (for rich editors, browsers, Zalo, etc.)
            int hr = element.GetCurrentPattern(UIA_TextPatternId, out var textPatternObj);
            if (hr == 0 && textPatternObj is IUIAutomationTextPattern textPattern)
            {
                hr = textPattern.get_DocumentRange(out var range);
                if (hr == 0 && range != null)
                {
                    hr = range.GetText(2000, out var text); // Limit to 2000 chars
                    if (hr == 0 && IsValidCapture(text))
                    {
                        _logger.LogDebug("Captured via TextPattern at depth {Depth} ({Length} chars)", depth, text.Length);
                        return text;
                    }
                }
            }

            // 2. Try ValuePattern (standard input fields)
            hr = element.GetCurrentPattern(UIA_ValuePatternId, out var valPatternObj);
            if (hr == 0 && valPatternObj is IUIAutomationValuePattern valPattern)
            {
                hr = valPattern.get_CurrentValue(out var text);
                if (hr == 0 && IsValidCapture(text))
                {
                    _logger.LogDebug("Captured via ValuePattern at depth {Depth} ({Length} chars)", depth, text.Length);
                    return text;
                }
            }

            // 3. Try Value property directly
            hr = element.GetCurrentPropertyValue(UIA_ValueValuePropertyId, out var value);
            if (hr == 0 && value is string strValue && IsValidCapture(strValue))
            {
                _logger.LogDebug("Captured via ValueProperty at depth {Depth} ({Length} chars)", depth, strValue.Length);
                return strValue;
            }

            // 4. Try Name property
            hr = element.GetCurrentPropertyValue(UIA_NamePropertyId, out var name);
            if (hr == 0 && name is string strName && IsValidCapture(strName))
            {
                // Name often contains "Zalo" or window titles, we should be careful
                if (!IsInternalAppName(strName))
                {
                    _logger.LogDebug("Captured via NameProperty at depth {Depth} ({Length} chars)", depth, strName.Length);
                    return strName;
                }
            }

            // 5. Recursive check on children if no text found yet
            // (Skipping for now to avoid complexity of IUIAutomationElementEnumerator definition, 
            // will implement if needed).
        }
        catch (COMException) { }

        return null;
    }

    private bool IsValidCapture(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        
        var trimmed = text.Trim();
        if (trimmed.Length < 2) return false;

        // Reject if the captured text is just the application name.
        // Some Electron apps (like Zalo) might return their name as the Value of the container element.
        if (IsInternalAppName(trimmed)) return false;

        return true;
    }

    private bool IsInternalAppName(string name)
    {
        var lower = name.ToLowerInvariant();
        return lower == "zalo" || lower == "facebook" || lower == "messenger" || 
               lower == "chrome" || lower == "google chrome" || lower == "microsoft edge" ||
               lower == "telegram" || lower == "desktop" || lower == "mặc định";
    }

    /// <summary>
    /// Fallback: Try to read text using Win32 SendMessage(WM_GETTEXT).
    /// Requires attaching to the target thread's input queue.
    /// </summary>
    private string? TryWin32GetText()
    {
        try
        {
            var foregroundWindow = GetForegroundWindow();
            if (foregroundWindow == IntPtr.Zero) return null;

            uint foregroundThreadId = GetWindowThreadProcessId(foregroundWindow, out _);
            uint currentThreadId = GetCurrentThreadId();

            IntPtr focusedHandle = IntPtr.Zero;

            if (foregroundThreadId != currentThreadId)
            {
                AttachThreadInput(currentThreadId, foregroundThreadId, true);
                focusedHandle = GetFocus();
                AttachThreadInput(currentThreadId, foregroundThreadId, false);
            }
            else
            {
                focusedHandle = GetFocus();
            }

            if (focusedHandle == IntPtr.Zero) return null;

            int length = SendMessageW(focusedHandle, WM_GETTEXTLENGTH, IntPtr.Zero, IntPtr.Zero);
            if (length <= 0) return null;

            var sb = new StringBuilder(length + 1);
            SendMessageW(focusedHandle, WM_GETTEXT, (IntPtr)(length + 1), sb);

            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Win32 WM_GETTEXT capture failed");
        }

        return null;
    }
}
