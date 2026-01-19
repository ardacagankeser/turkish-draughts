"""
TimerDisplay component for Turkish Draughts.

Displays countdown timer in MM:SS format with active/inactive styling.
Uses theme colors from ui/theme.py.
"""

import flet as ft
from typing import Optional

from ui.theme import COLORS, SIZES


def create_timer_display(
    time_seconds: Optional[int],
    is_active: bool = False,
    player_name: str = "Player",
    show_warning: bool = False,
) -> ft.Container:
    """
    Create a timer display component.
    
    Args:
        time_seconds: Remaining time in seconds, None for untimed
        is_active: Whether this player's timer is currently running
        player_name: Name/label for this player
        show_warning: Whether to show low time warning (red styling)
        
    Returns:
        Flet Container with the timer UI
    """
    # Format time as MM:SS
    if time_seconds is None:
        time_text = "∞"
    else:
        minutes = time_seconds // 60
        seconds = time_seconds % 60
        time_text = f"{minutes:02d}:{seconds:02d}"
    
    # Determine colors based on state
    if show_warning and time_seconds is not None and time_seconds <= 30:
        # Low time warning - red
        bg_color = COLORS["accent_red"]
        text_color = COLORS["text_white"]
        border_color = COLORS["accent_red"]
    elif is_active:
        # Active timer - green accent
        bg_color = COLORS["surface"]
        text_color = COLORS["accent_green"]
        border_color = COLORS["accent_green"]
    else:
        # Inactive timer - muted
        bg_color = COLORS["surface"]
        text_color = COLORS["text_gray"]
        border_color = COLORS["glass_border"]
    
    # Create time text
    time_display = ft.Text(
        time_text,
        size=SIZES["font_2xl"],
        weight=ft.FontWeight.BOLD,
        color=text_color,
        font_family=FONTS.get("monospace", "Consolas"),
    )
    
    # Create player label
    player_label = ft.Text(
        player_name,
        size=SIZES["font_sm"],
        color=COLORS["text_gray"] if not is_active else COLORS["text_white"],
    )
    
    # Active indicator dot
    active_dot = None
    if is_active:
        active_dot = ft.Container(
            width=8,
            height=8,
            bgcolor=COLORS["accent_green"],
            border_radius=4,
        )
    
    # Create header row with name and active indicator
    header_row = ft.Row(
        [
            player_label,
            active_dot if active_dot else ft.Container(width=8),
        ],
        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
    )
    
    # Wrap in styled container
    timer_container = ft.Container(
        content=ft.Column(
            [
                header_row,
                time_display,
            ],
            spacing=SIZES["spacing_xs"],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        ),
        width=140,
        height=SIZES["timer_height"],
        bgcolor=bg_color,
        border=ft.border.all(2, border_color),
        border_radius=SIZES["radius_md"],
        padding=ft.padding.symmetric(horizontal=SIZES["spacing_md"], vertical=SIZES["spacing_sm"]),
        alignment=ft.Alignment(0, 0),
    )
    
    return timer_container


# Fallback for FONTS if not imported
try:
    from ui.theme import FONTS
except ImportError:
    FONTS = {"monospace": "Consolas"}
