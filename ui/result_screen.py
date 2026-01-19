"""
Result Screen for Turkish Draughts.

Game over screen showing winner and statistics.
"""

import flet as ft
from typing import Callable, Optional, Dict

from game.types import Player
from ui.theme import COLORS, SIZES


def create_result_screen(
    winner: Optional[Player],
    total_moves: int,
    captures: Dict[Player, int],
    game_duration: float,
    player_side: Optional[Player] = None,
    on_return_to_menu: Optional[Callable[[], None]] = None,
) -> ft.Container:
    """
    Create the result screen.
    
    Args:
        winner: The winning player, or None for draw
        total_moves: Total number of moves played
        captures: Dict mapping Player to capture count
        game_duration: Game duration in seconds
        player_side: Human player's side (for AI mode messaging)
        on_return_to_menu: Callback for menu button
        
    Returns:
        Flet Container with the result UI
    """
    
    # Determine result message
    if winner is None:
        result_text = "DRAW"
        result_color = COLORS["accent_amber"]
        result_icon = ft.Icons.BALANCE
    elif player_side is not None:
        # AI mode - personalized message
        if winner == player_side:
            result_text = "YOU WIN!"
            result_color = COLORS["accent_green"]
            result_icon = ft.Icons.EMOJI_EVENTS
        else:
            result_text = "YOU LOSE"
            result_color = COLORS["accent_red"]
            result_icon = ft.Icons.SENTIMENT_DISSATISFIED
    else:
        # Local mode - show which color won
        if winner == Player.WHITE:
            result_text = "WHITE WINS!"
            result_color = COLORS["piece_white"]
            result_icon = ft.Icons.EMOJI_EVENTS
        else:
            result_text = "BLACK WINS!"
            result_color = COLORS["text_white"]
            result_icon = ft.Icons.EMOJI_EVENTS
    
    # Format duration
    minutes = int(game_duration // 60)
    seconds = int(game_duration % 60)
    duration_text = f"{minutes}:{seconds:02d}"
    
    # Trophy icon
    trophy = ft.Icon(
        result_icon,
        size=80,
        color=result_color,
    )
    
    # Result announcement
    result_announcement = ft.Text(
        result_text,
        size=SIZES["font_3xl"],
        weight=ft.FontWeight.BOLD,
        color=result_color,
    )
    
    # Stats section
    def create_stat_row(label: str, value: str) -> ft.Container:
        return ft.Container(
            content=ft.Row(
                [
                    ft.Text(
                        label,
                        size=SIZES["font_md"],
                        color=COLORS["text_gray"],
                    ),
                    ft.Container(expand=True),
                    ft.Text(
                        value,
                        size=SIZES["font_md"],
                        weight=ft.FontWeight.BOLD,
                        color=COLORS["text_white"],
                    ),
                ],
            ),
            padding=ft.padding.symmetric(vertical=SIZES["spacing_xs"]),
        )
    
    stats = ft.Container(
        content=ft.Column(
            [
                ft.Text(
                    "Game Statistics",
                    size=SIZES["font_lg"],
                    weight=ft.FontWeight.BOLD,
                    color=COLORS["text_white"],
                ),
                ft.Divider(color=COLORS["glass_border"], height=1),
                create_stat_row("Total Moves", str(total_moves)),
                create_stat_row("White Captures", str(captures.get(Player.WHITE, 0))),
                create_stat_row("Black Captures", str(captures.get(Player.BLACK, 0))),
                create_stat_row("Duration", duration_text),
            ],
            spacing=SIZES["spacing_xs"],
        ),
        width=300,
        bgcolor=COLORS["surface"],
        border=ft.border.all(1, COLORS["glass_border"]),
        border_radius=SIZES["radius_md"],
        padding=SIZES["spacing_md"],
        margin=ft.margin.only(top=SIZES["spacing_xl"]),
    )
    
    # Return to menu button
    menu_button = ft.Container(
        content=ft.Text(
            "RETURN TO MENU",
            size=SIZES["font_md"],
            weight=ft.FontWeight.BOLD,
            color=COLORS["text_white"],
        ),
        width=240,
        height=SIZES["button_height"],
        bgcolor=COLORS["primary"],
        border_radius=SIZES["radius_md"],
        alignment=ft.Alignment(0, 0),
        on_click=lambda e: on_return_to_menu() if on_return_to_menu else None,
        margin=ft.margin.only(top=SIZES["spacing_xl"]),
    )
    
    # Play again button (optional)
    play_again_button = ft.Container(
        content=ft.Text(
            "PLAY AGAIN",
            size=SIZES["font_md"],
            weight=ft.FontWeight.BOLD,
            color=COLORS["text_white"],
        ),
        width=240,
        height=SIZES["button_height"],
        bgcolor=COLORS["accent_green"],
        border_radius=SIZES["radius_md"],
        alignment=ft.Alignment(0, 0),
        on_click=lambda e: on_return_to_menu() if on_return_to_menu else None,
        margin=ft.margin.only(top=SIZES["spacing_md"]),
        shadow=ft.BoxShadow(
            spread_radius=0,
            blur_radius=20,
            color="#00B89440",
            offset=ft.Offset(0, 4),
        ),
    )
    
    # Main container
    result_container = ft.Container(
        content=ft.Column(
            [
                trophy,
                ft.Container(height=SIZES["spacing_md"]),
                result_announcement,
                stats,
                play_again_button,
                menu_button,
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            alignment=ft.MainAxisAlignment.CENTER,
        ),
        bgcolor=COLORS["bg_dark"],
        padding=SIZES["spacing_xl"],
        expand=True,
        alignment=ft.Alignment(0, 0),
    )
    
    return result_container
