"""
Theme constants for Turkish Draughts UI.

Color palette and styling constants inspired by HTML mockups.
This file contains no Flet imports - just pure Python values.
"""

# =============================================================================
# COLOR PALETTE
# =============================================================================

COLORS = {
    # Primary brand colors
    "primary": "#1c5b97",
    "primary_dark": "#164a7d",
    "primary_glow": "#3b82f6",
    
    # Background colors
    "bg_dark": "#0a0a0a",
    "bg_light": "#f5f5f5",
    "surface": "#121417",
    "surface_light": "#1e1e1e",
    
    # Glass effect colors
    "glass_dark": "rgba(20, 20, 20, 0.65)",
    "glass_border": "rgba(255, 255, 255, 0.08)",
    "glass_surface": "rgba(255, 255, 255, 0.03)",
    
    # Text colors
    "text_white": "#ffffff",
    "text_gray": "#9ca3af",
    "text_muted": "#6b7280",
    
    # Accent colors
    "accent_green": "#00B894",
    "accent_amber": "#FFBE0B",
    "accent_red": "#e53935",
    
    # Board colors (wood textures)
    "board_dark": "#4a3728",    # Walnut - dark squares
    "board_light": "#e3c699",   # Maple - light squares
    "board_frame": "#2e2016",   # Frame around board
    
    # Piece colors
    "piece_white": "#ffffff",
    "piece_white_shadow": "#90a4ae",
    "piece_black": "#2d2d2d",
    "piece_black_highlight": "#404040",
    
    # Game state colors
    "selected": "#1c5b97",      # Selected piece highlight
    "valid_move": "#00B894",    # Valid move indicator
    "capture_target": "#e53935", # Capture target highlight
    "last_move": "#FFBE0B",     # Last move indicator
    
    # UI element colors
    "button_primary": "#1c5b97",
    "button_hover": "#2563eb",
    "button_danger": "#dc2626",
    "button_success": "#00B894",
    "scrollbar_track": "#0a0a0a",
    "scrollbar_thumb": "#2a3137",
}


# =============================================================================
# FONTS
# =============================================================================

FONTS = {
    "display": "Space Grotesk",    # Headings, titles
    "body": "Manrope",             # Body text, UI elements
    "monospace": "JetBrains Mono", # Timer, move notation
}


# =============================================================================
# SIZES
# =============================================================================

SIZES = {
    # Board dimensions
    "board_size": 8,
    "square_size": 70,           # Pixels per square
    "board_padding": 16,         # Padding around board
    
    # Piece dimensions
    "piece_size": 56,            # Diameter of piece
    "piece_border": 3,           # Border width
    "crown_size": 24,            # King crown icon size
    
    # Spacing
    "spacing_xs": 4,
    "spacing_sm": 8,
    "spacing_md": 16,
    "spacing_lg": 24,
    "spacing_xl": 32,
    
    # Border radius
    "radius_sm": 4,
    "radius_md": 8,
    "radius_lg": 12,
    "radius_xl": 16,
    "radius_full": 9999,
    
    # Font sizes
    "font_xs": 12,
    "font_sm": 14,
    "font_md": 16,
    "font_lg": 20,
    "font_xl": 24,
    "font_2xl": 32,
    "font_3xl": 40,
    
    # Component heights
    "button_height": 48,
    "input_height": 44,
    "timer_height": 64,
    "sidebar_width": 280,
}


# =============================================================================
# SHADOWS (for reference, Flet uses elevation)
# =============================================================================

SHADOWS = {
    "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
    "board": "0 50px 70px -12px rgba(0, 0, 0, 0.7)",
    "piece": "0 4px 6px -1px rgba(0, 0, 0, 0.6)",
    "glow": "0 0 20px rgba(28, 91, 151, 0.3)",
}


# =============================================================================
# GRADIENTS (for reference)
# =============================================================================

GRADIENTS = {
    "glass": "linear-gradient(180deg, rgba(30, 30, 30, 0.6) 0%, rgba(10, 10, 10, 0.8) 100%)",
    "piece_white": "radial-gradient(circle at 35% 30%, #ffffff, #cfd8dc 60%, #90a4ae 100%)",
    "piece_black": "radial-gradient(circle at 35% 30%, #404040, #2d2d2d 80%)",
}
