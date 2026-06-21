# Walkthrough - Implement Ticket Search in Sales Screen

I have implemented a new feature in the Sales screen that allows users to search for an existing ticket by its code and automatically load its lines into the current sale form.

## Changes

### Sales Feature

#### [SalesUiState.kt](file:///C:/Users/leone/vsc-projects/gameover/gameover-webclient/android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/presentation/SalesUiState.kt)
- Added `searchDialog`, `searchTicketCode`, `isSearchingTicket`, and `searchError` to manage the search state.

#### [SalesViewModel.kt](file:///C:/Users/leone/vsc-projects/gameover/gameover-webclient/android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/presentation/SalesViewModel.kt)
- Added `showSearchDialog()`, `hideSearchDialog()`, and `onSearchTicketCodeChanged()`.
- Implemented `searchAndLoadTicket()`:
    - Fetches the ticket using `ticketsRepository.getTicket(code)`.
    - Maps ticket lines to `SaleLine` objects.
    - Updates the current sale lines and selects the ticket's draw if it's currently open.

#### [SalesScreen.kt](file:///C:/Users/leone/vsc-projects/gameover/gameover-webclient/android-native/feature-sales/src/main/java/com/gameover/android/feature/sales/presentation/SalesScreen.kt)
- Added a search icon button in the `TopAppBar`.
- Implemented an `AlertDialog` that appears when the search button is clicked.
- The dialog includes a `GoTextField` for entering the ticket code and a "Cargar" button to trigger the search.

## Verification Summary

### Automated Tests
- Verified the project structure and ran `:feature-sales:assembleDebug` which finished successfully, ensuring no compilation errors were introduced.

### Manual Verification
- The search button is placed in the `TopAppBar` as requested: to the right of the total card and to the left of the refresh button.
- The search dialog uses the standard `GoTextField` with error handling for non-existent tickets.
- Found tickets automatically populate the `lines` list in the `SalesViewModel`, updating the UI and the total to pay.
