"""
Menu Screen for Turkish Draughts.

Main menu with game configuration options.
Returns GameSettings when user starts a match.
"""

import flet as ft
from typing import Callable, Optional
import random

from game.types import GameSettings, GameMode, Difficulty, Player
from ui.theme import COLORS, SIZES


def create_menu_screen(
    on_start_game: Callable[[GameSettings], None],
) -> ft.Container:
    """
    Create the main menu screen.
    
    Args:
        on_start_game: Callback with GameSettings when user clicks Start
        
    Returns:
        Flet Container with the menu UI
    """
    # State variables
    state = {
        "mode": GameMode.AI,
        "difficulty": Difficulty.MEDIUM,
        "time": None,  # None = untimed
        "side": None,  # None = random
    }
    
    # References for dynamic updates
    content_ref = ft.Ref[ft.Column]()
    
    def rebuild_menu():
        """Rebuild the menu with current state."""
        if content_ref.current:
            content_ref.current.controls = build_menu_content()
            content_ref.current.update()
    
    def handle_start():
        """Handle Start Match button click."""
        player_side = state["side"]
        if player_side is None:
            player_side = random.choice([Player.WHITE, Player.BLACK])
        
        settings = GameSettings(
            mode=state["mode"],
            difficulty=state["difficulty"],
            time_limit=state["time"],
            player_side=player_side,
        )
        on_start_game(settings)
    
    def build_menu_content():
        """Build the menu content based on current state."""
        
        # Title
        title = ft.Container(
            content=ft.Column(
                [
                    ft.Text(
                        "DAMA",
                        size=SIZES["font_3xl"],
                        weight=ft.FontWeight.BOLD,
                        color=COLORS["text_white"],
                    ),
                    ft.Text(
                        "Turkish Draughts",
                        size=SIZES["font_lg"],
                        color=COLORS["text_gray"],
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=SIZES["spacing_xs"],
            ),
            alignment=ft.Alignment(0, 0),
            padding=SIZES["spacing_xl"],
        )
        
        # Mode buttons
        def create_mode_btn(label: str, mode: GameMode, icon: str):
            is_sel = state["mode"] == mode
            
            def on_click(e):
                state["mode"] = mode
                rebuild_menu()
            
            return ft.Container(
                content=ft.Row(
                    [
                        ft.Icon(icon, color=COLORS["text_white"] if is_sel else COLORS["text_gray"], size=24),
                        ft.Text(label, size=SIZES["font_md"], 
                               weight=ft.FontWeight.BOLD if is_sel else ft.FontWeight.NORMAL,
                               color=COLORS["text_white"] if is_sel else COLORS["text_gray"]),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    spacing=SIZES["spacing_sm"],
                ),
                width=180,
                height=SIZES["button_height"],
                bgcolor=COLORS["primary"] if is_sel else COLORS["surface"],
                border=ft.border.all(2, COLORS["primary"] if is_sel else COLORS["glass_border"]),
                border_radius=SIZES["radius_md"],
                alignment=ft.Alignment(0, 0),
                on_click=on_click,
            )
        
        mode_section = ft.Column(
            [
                ft.Text("Game Mode", size=SIZES["font_sm"], color=COLORS["text_gray"]),
                ft.Row(
                    [
                        create_mode_btn("Play vs AI", GameMode.AI, ft.Icons.SMART_TOY),
                        create_mode_btn("Local Match", GameMode.LOCAL, ft.Icons.PEOPLE),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    spacing=SIZES["spacing_md"],
                ),
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            spacing=SIZES["spacing_sm"],
        )
        
        # Difficulty buttons
        def create_diff_btn(label: str, diff: Difficulty):
            is_sel = state["difficulty"] == diff
            
            def on_click(e):
                state["difficulty"] = diff
                rebuild_menu()
            
            return ft.Container(
                content=ft.Text(label, size=SIZES["font_sm"],
                               weight=ft.FontWeight.BOLD if is_sel else ft.FontWeight.NORMAL,
                               color=COLORS["text_white"] if is_sel else COLORS["text_gray"]),
                width=90,
                height=40,
                bgcolor=COLORS["primary"] if is_sel else COLORS["surface"],
                border=ft.border.all(1, COLORS["primary"] if is_sel else COLORS["glass_border"]),
                border_radius=SIZES["radius_sm"],
                alignment=ft.Alignment(0, 0),
                on_click=on_click,
            )
        
        difficulty_section = ft.Container(
            content=ft.Column(
                [
                    ft.Text("Difficulty", size=SIZES["font_sm"], color=COLORS["text_gray"]),
                    ft.Row(
                        [
                            create_diff_btn("Easy", Difficulty.EASY),
                            create_diff_btn("Medium", Difficulty.MEDIUM),
                            create_diff_btn("Hard", Difficulty.HARD),
                            create_diff_btn("Master", Difficulty.GRANDMASTER),
                        ],
                        alignment=ft.MainAxisAlignment.CENTER,
                        spacing=SIZES["spacing_xs"],
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=SIZES["spacing_sm"],
            ),
            visible=(state["mode"] == GameMode.AI),
        )
        
        # Time buttons
        def create_time_btn(label: str, value: Optional[int]):
            is_sel = state["time"] == value
            
            def on_click(e):
                state["time"] = value
                rebuild_menu()
            
            return ft.Container(
                content=ft.Text(label, size=SIZES["font_sm"],
                               color=COLORS["text_white"] if is_sel else COLORS["text_gray"]),
                width=70,
                height=36,
                bgcolor=COLORS["primary"] if is_sel else COLORS["surface"],
                border=ft.border.all(1, COLORS["primary"] if is_sel else COLORS["glass_border"]),
                border_radius=SIZES["radius_sm"],
                alignment=ft.Alignment(0, 0),
                on_click=on_click,
            )
        
        time_section = ft.Column(
            [
                ft.Text("Time Control", size=SIZES["font_sm"], color=COLORS["text_gray"]),
                ft.Row(
                    [
                        create_time_btn("None", None),
                        create_time_btn("3 min", 180),
                        create_time_btn("5 min", 300),
                        create_time_btn("10 min", 600),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    spacing=SIZES["spacing_xs"],
                ),
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            spacing=SIZES["spacing_sm"],
        )
        
        # Side buttons (fixed padding)
        def create_side_btn(label: str, value: Optional[Player], icon: str):
            is_sel = state["side"] == value
            
            def on_click(e):
                state["side"] = value
                rebuild_menu()
            
            return ft.Container(
                content=ft.Column(
                    [
                        ft.Icon(icon, color=COLORS["text_white"] if is_sel else COLORS["text_gray"], size=20),
                        ft.Text(label, size=SIZES["font_xs"],
                               color=COLORS["text_white"] if is_sel else COLORS["text_gray"]),
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=4,
                    alignment=ft.MainAxisAlignment.CENTER,
                ),
                width=70,
                height=60,
                bgcolor=COLORS["primary"] if is_sel else COLORS["surface"],
                border=ft.border.all(1, COLORS["primary"] if is_sel else COLORS["glass_border"]),
                border_radius=SIZES["radius_sm"],
                alignment=ft.Alignment(0, 0),
                padding=ft.padding.symmetric(vertical=8),
                on_click=on_click,
            )
        
        side_section = ft.Column(
            [
                ft.Text("Play As", size=SIZES["font_sm"], color=COLORS["text_gray"]),
                ft.Row(
                    [
                        create_side_btn("White", Player.WHITE, ft.Icons.CIRCLE),
                        create_side_btn("Random", None, ft.Icons.SHUFFLE),
                        create_side_btn("Black", Player.BLACK, ft.Icons.CIRCLE_OUTLINED),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER,
                    spacing=SIZES["spacing_sm"],
                ),
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            spacing=SIZES["spacing_sm"],
        )
        
        # Start button
        start_button = ft.Container(
            content=ft.Text(
                "START MATCH",
                size=SIZES["font_lg"],
                weight=ft.FontWeight.BOLD,
                color=COLORS["text_white"],
            ),
            width=280,
            height=56,
            bgcolor=COLORS["accent_green"],
            border_radius=SIZES["radius_lg"],
            alignment=ft.Alignment(0, 0),
            on_click=lambda e: handle_start(),
            shadow=ft.BoxShadow(
                spread_radius=0,
                blur_radius=20,
                color="#00B89440",
                offset=ft.Offset(0, 4),
            ),
        )
        
        return [
            title,
            ft.Container(height=SIZES["spacing_lg"]),
            mode_section,
            ft.Container(height=SIZES["spacing_md"]),
            difficulty_section,
            ft.Container(height=SIZES["spacing_md"]),
            time_section,
            ft.Container(height=SIZES["spacing_md"]),
            side_section,
            ft.Container(height=SIZES["spacing_xl"]),
            start_button,
        ]
    
    # Main container
    menu_container = ft.Container(
        content=ft.Column(
            ref=content_ref,
            controls=build_menu_content(),
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            alignment=ft.MainAxisAlignment.CENTER,
        ),
        bgcolor=COLORS["bg_dark"],
        padding=SIZES["spacing_xl"],
        expand=True,
    )
    
    return menu_container
