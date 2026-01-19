"""
CapturedPieces component for Turkish Draughts.

Displays captured pieces count for each player.
Uses theme colors from ui/theme.py.
"""

import flet as ft
from typing import Dict

from game.types import Player
from ui.theme import COLORS, SIZES


def create_captured_pieces(
    captures: Dict[Player, int],
) -> ft.Container:
    """
    Create a captured pieces display component.
    
    Args:
        captures: Dict mapping Player to capture count
        
    Returns:
        Flet Container with the captured pieces UI
    """
    white_captures = captures.get(Player.WHITE, 0)
    black_captures = captures.get(Player.BLACK, 0)
    
    def create_mini_piece(is_white: bool) -> ft.Container:
        """Create a mini piece icon."""
        return ft.Container(
            width=16,
            height=16,
            bgcolor=COLORS["piece_white"] if is_white else COLORS["piece_black"],
            border=ft.border.all(
                1, 
                COLORS["piece_white_shadow"] if is_white else "#555555"
            ),
            border_radius=8,
        )
    
    def create_capture_row(
        player: Player, 
        count: int, 
        label: str
    ) -> ft.Container:
        """Create a row showing captured pieces for one player."""
        is_capturing_white = player == Player.WHITE
        
        # The pieces captured BY this player are the opponent's pieces
        captured_piece_is_white = not is_capturing_white
        
        # Create mini pieces to represent captured count (max 8 shown)
        piece_icons = []
        for i in range(min(count, 8)):
            piece_icons.append(create_mini_piece(captured_piece_is_white))
        
        # If more than 8, show ellipsis
        if count > 8:
            piece_icons.append(
                ft.Text("...", size=SIZES["font_xs"], color=COLORS["text_gray"])
            )
        
        # Count text
        count_text = ft.Text(
            f"×{count}",
            size=SIZES["font_md"],
            weight=ft.FontWeight.BOLD,
            color=COLORS["text_white"],
        )
        
        # Player indicator
        player_indicator = ft.Container(
            width=12,
            height=12,
            bgcolor=COLORS["piece_white"] if is_capturing_white else COLORS["piece_black"],
            border=ft.border.all(1, COLORS["text_gray"]),
            border_radius=6,
        )
        
        # Label
        player_label = ft.Text(
            label,
            size=SIZES["font_xs"],
            color=COLORS["text_gray"],
        )
        
        # Pieces row
        pieces_row = ft.Row(
            piece_icons,
            spacing=2,
            wrap=True,
        ) if piece_icons else ft.Text(
            "-",
            size=SIZES["font_sm"],
            color=COLORS["text_muted"],
        )
        
        return ft.Container(
            content=ft.Column(
                [
                    ft.Row(
                        [
                            player_indicator,
                            player_label,
                            ft.Container(expand=True),
                            count_text,
                        ],
                        alignment=ft.MainAxisAlignment.START,
                    ),
                    pieces_row,
                ],
                spacing=SIZES["spacing_xs"],
            ),
            padding=ft.padding.symmetric(
                horizontal=SIZES["spacing_sm"],
                vertical=SIZES["spacing_xs"],
            ),
        )
    
    # Header
    header = ft.Text(
        "Captured",
        size=SIZES["font_md"],
        weight=ft.FontWeight.BOLD,
        color=COLORS["text_white"],
    )
    
    # Create rows for each player
    white_row = create_capture_row(Player.WHITE, white_captures, "White")
    black_row = create_capture_row(Player.BLACK, black_captures, "Black")
    
    # Divider
    divider = ft.Container(
        height=1,
        bgcolor=COLORS["glass_border"],
        margin=ft.margin.symmetric(vertical=SIZES["spacing_xs"]),
    )
    
    # Main container
    captured_container = ft.Container(
        content=ft.Column(
            [
                ft.Container(
                    content=header,
                    padding=ft.padding.only(
                        left=SIZES["spacing_sm"],
                        bottom=SIZES["spacing_xs"],
                    ),
                ),
                white_row,
                divider,
                black_row,
            ],
            spacing=0,
        ),
        bgcolor=COLORS["surface"],
        border=ft.border.all(1, COLORS["glass_border"]),
        border_radius=SIZES["radius_md"],
        padding=SIZES["spacing_sm"],
    )
    
    return captured_container
